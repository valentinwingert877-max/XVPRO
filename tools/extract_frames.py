"""
Extraction de frames pour annotation YOLOv8 rugby
Usage: python extract_frames.py
"""
import cv2
import os
import random

VIDEO_PATH = r"C:\Users\petit\Desktop\Segment_00000.mov"
OUTPUT_DIR = r"C:\Users\petit\Desktop\frames_rugby"
FRAMES_PER_SECOND = 0.33  # 1 frame toutes les 3 secondes
MAX_FRAMES = 1500          # max frames à extraire

os.makedirs(OUTPUT_DIR, exist_ok=True)

cap = cv2.VideoCapture(VIDEO_PATH)
fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration_sec = total_frames / fps

print(f"Vidéo : {duration_sec:.0f}s — {total_frames} frames — {fps:.1f} fps")

interval = int(fps / FRAMES_PER_SECOND)
saved = 0
frame_idx = 0

while cap.isOpened() and saved < MAX_FRAMES:
    ret, frame = cap.read()
    if not ret:
        break

    if frame_idx % interval == 0:
        filename = os.path.join(OUTPUT_DIR, f"frame_{frame_idx:07d}.jpg")
        cv2.imwrite(filename, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        saved += 1
        if saved % 50 == 0:
            print(f"  {saved} frames extraites...")

    frame_idx += 1

cap.release()
print(f"\nTerminé ! {saved} frames sauvegardées dans :")
print(f"  {OUTPUT_DIR}")
print(f"\nProchaine étape : upload ces frames sur roboflow.com pour les annoter.")
