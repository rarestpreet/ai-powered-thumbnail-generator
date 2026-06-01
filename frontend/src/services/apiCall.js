import api from "../util/api";

const testApi = async () => {
    try {
        const res = await api.get(
            "/test"
        )

        return res.data
    } catch (e) {
        console.log(e)
    }
}

const uploadHeadshot = async (file) => {
    const form = new FormData()
    form.append("file", file)

    try {
        const res = await api.post(
            "/upload-headshot",
            form
        )

        return res.data
    } catch (e) {
        console.log(e)
    }
}

const createJob = async ({ prompt, num_thumbnails, headshot_url }) => {
    try {
        const body = {
            prompt,
            num_thumbnails,
            headshot_url
        }
        console.log(body);

        const res = await api.post(
            "/job",
            body
        )

        return res.data
    } catch (e) {
        console.log(e)
    }
}

const subscribeToJob = async (jobId, { onThumbnailReady, onThumbnailFailed, onJobComplete, OnError }) => {
    const eventSource = new EventSource(
        `jobs/${jobId}/stream`
    )

    try {
        eventSource.addEventListener("thumbnail_ready", (e) =>
            onThumbnailReady(JSON.parse(e.data))
        )

        eventSource.addEventListener("thumbnail_failed", (e) => {
            onThumbnailFailed(JSON.parse(e.data))
            eventSource.close()
        })

        eventSource.addEventListener("job_complete", (e) => {
            onJobComplete(JSON.parse(e.data))
            eventSource.close()
        })
    } catch (e) {
        eventSource.addEventListener("error", (e) => {
            OnError(JSON.parse(e.data))
            eventSource.close()
        })

        console.log(e)
    }

    return eventSource
}

const apiCall = {
    testApi,
    uploadHeadshot,
    createJob,
    subscribeToJob
}

export default apiCall