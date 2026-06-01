import requests
import asyncio
from io import BytesIO
from PIL import Image

from huggingface_hub import InferenceClient

from config import HUGGING_API_KEY

client = InferenceClient(api_key=HUGGING_API_KEY)


async def test():
    try:
        completion = client.chat.completions.create(
            model="Qwen/Qwen2.5-Coder-3B-Instruct:nscale",
            messages=[{"role": "user", "content": "What is the capital of France?"}],
        )

        print(completion.choices[0].message)
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(str(e))


async def generate_thumbnail(prompt: str, style_prompt, headshot_url: str) -> bytes:
    """Use the Responses API with gpt-image-2 as a built-in image_generation tool.
    Pass the headshot URL directly as an input_image.
    Returns raw PNG bytes.
    """

    full_prompt = (
        f"{style_prompt}\n\n"
        f"User request: {prompt}\n\n"
        "IMPORTANT: The generated thumbnail MUST prominently feature the person "
        "shown in the provided reference headshot photo. Keep their likeness accurate."
    )
    image_bytes = requests.get(headshot_url).content

    image = Image.open(BytesIO(image_bytes))

    try:
        response = await asyncio.to_thread(
            client.image_to_image, image=image, prompt=full_prompt
        )

        print(response)
    except Exception as e:
        import traceback

        traceback.print_exc()

        print(type(e))
        print(str(e))

    buffer = BytesIO()
    response.save(buffer, format="PNG")
    return buffer.getvalue()

    raise RuntimeError("No image generated")
