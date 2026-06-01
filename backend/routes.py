import asyncio
import logging
from services.ai_service import test
import json

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from model import Job, Thumbnail

from services.generator import process_job, STYLE_ORDER
from services.imagekit_service import upload_file, get_variants

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class CreateJobRequst(BaseModel):
    prompt: str
    num_thumbnails: int
    headshot_url: str


class CreateJobResponse(BaseModel):
    job_id: str


class ThumbnailResposne(BaseModel):
    id: int
    style_name: str
    status: str
    imagekit_url: str | None = None
    error_message: str | None = None
    variants: dict | None = None


class JobResponse(BaseModel):
    id: int
    prompt: str
    num_thumbnails: int
    headshot_url: str
    status: str
    thumbnails: list[ThumbnailResposne]


@router.post("/upload-headshot")
async def upload_headshot(file: UploadFile = File(...)):
    contents = await file.read()

    url = upload_file(
        file_bytes=contents,
        file_name=file.filename or "headshot.jpg",
        folder="headshots",
        content_type=file.content_type or "image/jpg",
    )
    return {"url": url}


@router.post("/job", response_model=CreateJobResponse)
async def create_job(request: CreateJobRequst, session: Session = Depends(get_session)):
    if request.num_thumbnails < 1 or request.num_thumbnails > 3:
        raise HTTPException(status_code=400, detail="Invalid number of thumbnails")

    job = Job(
        prompt=request.prompt,
        num_thumbnails=request.num_thumbnails,
        headshot_url=request.headshot_url,
    )
    session.add(job)

    styles = STYLE_ORDER[: request.num_thumbnails]
    for style in styles:
        thumbnail = Thumbnail(job_id=job.id, style_name=style)
        session.add(thumbnail)

    session.commit()

    asyncio.create_task(process_job(job.id))

    return CreateJobResponse(job_id=job.id)


@router.get("/jobs/{jobId}", response_model=JobResponse)
async def get_job(jobId: str, session: Session = Depends(get_session)):
    job = session.get(Job, jobId)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    thumbnails = session.exec(select(Thumbnail).where(Thumbnail.job_id == jobId)).all()

    thumbResponse = []
    for t in thumbnails:
        variants = get_variants((t.imagekit_url) if t.imagekit_url else None)
        thumbResponse.append(
            ThumbnailResposne(
                id=t.id,
                style_name=t.style_name,
                status=t.status,
                imagekit_url=t.imagekit_url,
                error_message=t.error_message,
                variants=variants,
            )
        )

    return JobResponse(
        id=job.id,
        prompt=job.prompt,
        num_thumbnails=job.num_thumbnails,
        headshot_url=job.headshot_url,
        status=job.status,
        thumbnails=thumbResponse,
    )


@router.get("/jobs/{jobId}/stream")
async def stream_job(jobId: str):
    async def event_generator():
        from database import engine

        sent_thumbnails = set()

        while True:
            with Session(engine) as session:
                job = session.get(Job, jobId)
                if not job:
                    yield f"event: error\ndata: {json.dumps({'error': 'Job not found'})}"
                    return
                thumbnails = session.exec(
                    select(Thumbnail).where(Thumbnail.job_id == jobId)
                ).all()
                for t in thumbnails:
                    if t.id in sent_thumbnails:
                        continue
                    if t.status == "uploaded":
                        variants = get_variants(t.imagekit_url)
                        data = json.dumps(
                            {
                                "thumbnail_id": t.id,
                                "style_name": t.style_name,
                                "imagekit_url": t.imagekit_url,
                                "variants": variants,
                            }
                        )
                        yield f"event: thumbnail_ready\ndata: {data}"
                        sent_thumbnails.add(t.id)
                    elif t.status == "failed":
                        data = json.dumps(
                            {
                                "thumbnail_id": t.id,
                                "style_name": t.style_name,
                                "error_message": t.error_message,
                            }
                        )
                        yield f"event: thumbnail_failed\ndata: {data}"
                        sent_thumbnails.add(t.id)

                allDone = all(t.status in ("uploaded", "failed") for t in thumbnails)
                if allDone and len(sent_thumbnails) == len(thumbnails):
                    data = json.dumps({"job_id": jobId, "status": job.status})
                    yield f"event: job_completed\n data: {data}"
                    return

            await asyncio.sleep(1.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/test")
async def test_openai():
    return {"response": await test()}
