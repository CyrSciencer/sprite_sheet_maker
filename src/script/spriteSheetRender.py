import os
from PIL import Image

# --- Configuration ---
# You MUST change this to the directory where Blender saved the 64 images.
# Example: 'C:/Users/YourName/Desktop/Blender_Renders/project_name/'
RENDER_DIR = '/home/cyrsciencer/3dto2d/Adv' 

STEPS = 8      # Number of rotational viewpoints (rows in sprite sheet)
FRAMES = 7     # Number of animation frames (columns in sprite sheet)
OUTPUT_FILENAME = 'sprite_sheet_8x7.png'
# ---------------------

def create_sprite_sheet():
    print(f"Starting sprite sheet generation from: {RENDER_DIR}")
    
    # Check if the directory exists
    if not os.path.isdir(RENDER_DIR):
        print(f"Error: Directory not found at {RENDER_DIR}")
        return

    # 1. Get the first image to determine dimensions
    first_file = f"render_direction1_fr1.png"
    first_path = os.path.join(RENDER_DIR, first_file)
    
    try:
        with Image.open(first_path) as img:
            tile_width, tile_height = img.size
    except FileNotFoundError:
        print(f"Error: Could not find starting file {first_file}. Check your RENDER_DIR path.")
        return

    # Calculate final sheet dimensions (assuming all images are the same size)
    sheet_width = tile_width * FRAMES
    sheet_height = tile_height * STEPS
    
    # Create the new blank image for the sprite sheet
    sprite_sheet = Image.new('RGBA', (sheet_width, sheet_height))

    # 2. Loop through all images and paste them onto the sheet
    missing_files = 0
    for i in range(STEPS):      # i: Direction (Row index)
        for j in range(FRAMES): # j: Frame (Column index)
            # Blender script uses 1-based indexing for direction and frame
            direction_num = i + 1
            frame_num = j + 1
            
            # The file name is based on the Blender script's naming convention
            file_name = f"render_direction{direction_num}_fr{frame_num}.png"
            file_path = os.path.join(RENDER_DIR, file_name)
            
            try:
                with Image.open(file_path) as img:
                    # Calculate position to paste the tile
                    x_pos = j * tile_width
                    y_pos = i * tile_height
                    
                    sprite_sheet.paste(img, (x_pos, y_pos))
            except FileNotFoundError:
                missing_files += 1
                # Skip to the next file if one is missing
                continue

    # 3. Save the final sprite sheet
    if missing_files > 0:
        print(f"Warning: {missing_files} files were missing during the process.")

    output_path = os.path.join(RENDER_DIR, OUTPUT_FILENAME)
    sprite_sheet.save(output_path)
    print(f"\n✅ Successfully created sprite sheet and saved to: {output_path}")

if __name__ == "__main__":
    create_sprite_sheet()