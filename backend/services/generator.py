import asyncio
import logging

from sqlmodel import Session, select
from database import engine
from model import Job, Thumbnail
from services.ai_service import generate_thumbnail
from services.imagekit_service import upload_file

logger = logging.getLogger(__name__)

# Pre-defined visual styles that provide specific aesthetic instructions to the AI model.
STYLES = {
    "bold_dramatic": (
        "Create a bold, dramatic YouTube thumbnail with high contrast, "
        "cinematic lighting, dark moody background, and powerful composition. "
        ""
        "The person's face should be prominent with a dramatic expression."
    ),
    "clean_minimal": (
        "Create a clean, minimal YouTube thumbnail with bright lighting, "
        "white/light background, modern professional aesthetic, plenty of "
        "whitespace, and sharp clean composition. The person should look "
        "approachable and professional."
    ),
    "vibrant_energetic": (
        "Create a vibrant, energetic YouTube thumbnail with colorful "
        "gradients, "
        "dynamic angles, eye-catching pop-art style colors, and energetic "
        "composition. The person should have an excited or engaging "
        "expression."
    ),
}

STYLE_ORDER = ["bold_dramatic", "clean_minimal", "vibrant_energetic"]


async def generate_single_thumbnail(thumbnail_id: str, prompt: str, headshot_url: str):
    """Process:
    - update the status of thumbnail in generation and retrieve necessary info (style_name)
    - generate thumbnail using OpenAI model
    - upload thumbnail to ImageKit and retrieve the url to store it in DB and status = uploaded
    - if generation failed due to some error, set the error message and status = failed
    """
    with Session(engine) as session:
        thumb_info = session.get(Thumbnail, thumbnail_id)
        thumb_info.status = "generating"
        style_name = thumb_info.style_name
        session.add(thumb_info)
        session.commit()

    style_prompt = STYLES[style_name]

    try:
        image_byte = await generate_thumbnail(prompt, style_prompt, headshot_url)

        with Session(engine) as session:
            thumb_info = session.get(Thumbnail, thumbnail_id)
            job_id = thumb_info.job_id

        url = upload_file(
            file_bytes=image_byte,
            file_name=f"{thumbnail_id}.png",
            folder=f"thumbnails/{job_id}/",
        )

        with Session(engine) as session:
            thumb_info = session.get(Thumbnail, thumbnail_id)
            thumb_info.imagekit_url = url
            thumb_info.status = "uploaded"
            session.add(thumb_info)
            session.commit()

        logger.info(f"Thumbnail {thumbnail_id} generated successfully")

    except Exception as e:
        logger.error(f"Error generating thumbnail {thumbnail_id}: {e}")
        with Session(engine) as session:
            thumb_info = session.get(Thumbnail, thumbnail_id)
            thumb_info.status = "error"
            thumb_info.error_message = str(e)[:300]
            session.add(thumb_info)
            session.commit()


async def process_job(job_id: str):
    """Process:
    - Retrieve the job (job_id) and thumbnail (associated with the job) from DB
    - use asynchronous generation for each thumbnail to reduce overall time
    - mark the end of job with either failed or completed
    """
    with Session(engine) as session:
        job_info = session.get(Job, job_id)
        job_info.status = "processing"
        prompt = job_info.prompt
        headshot_url = job_info.headshot_url
        session.add(job_info)
        session.commit()

        print("url", headshot_url)
        thumb_info = session.exec(select(Thumbnail).where(Thumbnail.job_id == job_id))
        thumbnail_ids = [t.id for t in thumb_info]

        tasks = [
            generate_single_thumbnail(tid, prompt, headshot_url)
            for tid in thumbnail_ids
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

        with Session(engine) as session:
            thumb_info = session.exec(
                select(Thumbnail).where(Thumbnail.job_id == job_id)
            ).all()
            all_failed = all(t.status == "failed" for t in thumb_info)
            job = session.get(Job, job_id)
            job.status = "failed" if all_failed else "completed"
            session.add(job)
            session.commit()
