# Save as scratch/seed_prompts.py
import os
from dotenv import load_dotenv
from langfuse import Langfuse
from agent import GENERATE_SYSTEM, REFINE_SYSTEM

load_dotenv()

langfuse = Langfuse(
    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
    host=os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com")
)

langfuse.create_prompt(name="website-generator-base", prompt=GENERATE_SYSTEM, labels=["production"])
langfuse.create_prompt(name="website-refiner-base", prompt=REFINE_SYSTEM, labels=["production"])
print("Prompts seeded to Langfuse successfully!")
