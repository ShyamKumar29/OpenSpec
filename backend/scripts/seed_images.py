import os
from PIL import Image, ImageDraw

def seed_mock_images(doc_ids):
    # This correctly paths from backend/scripts -> backend -> OpenSpec Root -> frontend
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    root_dir = os.path.dirname(backend_dir)
    
    mock_dir = os.path.join(root_dir, "frontend", "public", "mock", "pages")
    
    for doc_id in doc_ids:
        doc_folder = os.path.join(mock_dir, doc_id)
        os.makedirs(doc_folder, exist_ok=True)
        
        # Generate a 850x1100 gray image
        img = Image.new('RGB', (850, 1100), color=(220, 220, 220))
        draw = ImageDraw.Draw(img)
        
        # Draw a darker gray box in the top left
        draw.rectangle([0, 0, 150, 150], fill=(180, 180, 180))
        
        # Save it as page 1
        image_path = os.path.join(doc_folder, "1.png")
        img.save(image_path)
        print(f"✅ Seeded image for {doc_id} at {image_path}")

if __name__ == "__main__":
    # Add any new document IDs here when you expand your catalog!
    mock_documents = [
        "doc_demo_v1",
        "doc_abc123",
        "doc_xyz789",
        "doc_def456"
    ]
    
    seed_mock_images(mock_documents)
    print("Seeding complete!")