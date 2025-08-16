#!/usr/bin/env python3
"""
KargoMarketing KM Logo Generator
Generates app icons in different sizes for Expo/React Native app
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_km_logo(size: int) -> Image.Image:
    """Create KM logo with given size"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Center coordinates
    center_x, center_y = size // 2, size // 2
    radius = size // 2 - 20
    
    # Create gradient background (simplified)
    # Main blue circle
    draw.ellipse(
        [center_x - radius, center_y - radius, center_x + radius, center_y + radius],
        fill=(59, 130, 246, 255),  # #3b82f6
        outline=(29, 78, 216, 255),  # #1d4ed8
        width=4
    )
    
    # Outer ring effect
    ring_radius = radius + 10
    draw.ellipse(
        [center_x - ring_radius, center_y - ring_radius, center_x + ring_radius, center_y + ring_radius],
        fill=None,
        outline=(255, 107, 107, 180),  # Semi-transparent rainbow color
        width=6
    )
    
    # Try to load a bold font, fallback to default
    font_size = int(size * 0.35)
    try:
        # Try to use a system font
        font = ImageFont.truetype("arial.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    
    # Draw KM text
    text = "KM"
    
    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center_x - text_width // 2
    text_y = center_y - text_height // 2
    
    # Draw text shadow
    shadow_offset = max(2, size // 100)
    draw.text((text_x + shadow_offset, text_y + shadow_offset), text, 
              fill=(0, 0, 0, 100), font=font)
    
    # Draw main text
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    return img

def main() -> None:
    """Generate all required icon sizes"""
    assets_dir = "assets"
    
    # Create assets directory if it doesn't exist
    if not os.path.exists(assets_dir):
        os.makedirs(assets_dir)
    
    # Icon sizes and filenames
    icons = [
        (512, "icon.png"),           # Main app icon
        (192, "adaptive-icon.png"),  # Android adaptive icon
        (1024, "splash-icon.png"),   # Splash screen icon
        (48, "favicon.png")          # Favicon
    ]
    
    print("🎨 KargoMarketing KM Logo Generator")
    print("=" * 40)
    
    for size, filename in icons:
        print(f"📱 Generating {filename} ({size}x{size})...")
        
        # Create logo
        logo = create_km_logo(size)
        
        # Save as PNG
        filepath = os.path.join(assets_dir, filename)
        logo.save(filepath, "PNG", quality=95)
        
        print(f"✅ Saved: {filepath}")
    
    print("\n🎉 All logos generated successfully!")
    print("📋 Files created:")
    for size, filename in icons:
        print(f"   - {filename} ({size}x{size})")

if __name__ == "__main__":
    main()
