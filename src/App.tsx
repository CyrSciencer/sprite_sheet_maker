import { useState } from "react";
import "./App.css";

interface FileWithPreview extends File {
  preview?: string;
}

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<FileWithPreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedSpriteSheet, setGeneratedSpriteSheet] = useState<
    string | null
  >(null);
  const [gridDimensions, setGridDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [grid, setGrid] = useState({
    steps: 8,
    frames: 7,
  });
  const [totalSlots, setTotalSlots] = useState(grid.steps * grid.frames);
  // Sprite sheet configuration
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
    const filesWithPreview = files.map((file) => {
      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.preview = URL.createObjectURL(file);
      return fileWithPreview;
    });

    // Find the first empty slot
    let firstEmptySlot = -1;
    for (let i = 0; i < totalSlots; i++) {
      if (!uploadedFiles[i]) {
        firstEmptySlot = i;
        break;
      }
    }

    let newFiles;
    if (firstEmptySlot >= 0) {
      // Add new files to existing files, filling empty slots
      newFiles = [...uploadedFiles];
      filesWithPreview.forEach((file, index) => {
        const slotIndex = firstEmptySlot + index;
        if (slotIndex < totalSlots) {
          newFiles[slotIndex] = file;
        }
      });
    } else {
      // If no empty slots, replace existing files
      newFiles = filesWithPreview;
    }

    setUploadedFiles(newFiles);

    // Calculate grid dimensions after file upload
    console.log("📁 File upload complete, calculating dimensions...");
    await calculateGridDimensions(newFiles);

    // Clear the input so the same files can be selected again
    event.target.value = "";
  };

  const calculateGridDimensions = async (files: FileWithPreview[]) => {
    // Filter out undefined files and load images
    const validFiles = files.filter((file) => file && file.preview);
    console.log(
      "🔍 Calculating grid dimensions for",
      validFiles.length,
      "valid files out of",
      files.length,
      "total"
    );

    if (validFiles.length === 0) {
      setGridDimensions(null);
      return;
    }

    try {
      const imagePromises = validFiles.map((file) => loadImage(file.preview!));
      const images = await Promise.all(imagePromises);

      let maxWidth = 0;
      let maxHeight = 0;
      images.forEach((img) => {
        maxWidth = Math.max(maxWidth, img.width);
        maxHeight = Math.max(maxHeight, img.height);
      });

      console.log("📏 Found max dimensions:", maxWidth, "x", maxHeight);

      // Apply 1080px limit
      const MAX_DIMENSION = 1080;
      let tileWidth = maxWidth;
      let tileHeight = maxHeight;

      if (Math.max(tileWidth, tileHeight) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(tileWidth, tileHeight);
        tileWidth = Math.floor(tileWidth * scale);
        tileHeight = Math.floor(tileHeight * scale);
        console.log("📏 Scaled to:", tileWidth, "x", tileHeight);
      }

      console.log("✅ Setting grid dimensions:", tileWidth, "x", tileHeight);
      setGridDimensions({ width: tileWidth, height: tileHeight });
    } catch (error) {
      console.error("Error calculating grid dimensions:", error);
    }
  };

  const getGridPosition = (index: number) => {
    const row = Math.floor(index / grid.frames);
    const col = index % grid.frames;
    return { row, col };
  };

  const SlotNumber = ({ row, col }: { row: number; col: number }) => {
    return (
      <div>
        R{row}C{col}
        <input
          type="number"
          value={row}
          onChange={(e) => {
            setGrid({ ...grid, steps: parseInt(e.target.value) });
            setTotalSlots(parseInt(e.target.value) * grid.frames);
          }}
        />
        <input
          type="number"
          value={col}
          onChange={(e) => {
            setGrid({ ...grid, frames: parseInt(e.target.value) });
            setTotalSlots(grid.steps * parseInt(e.target.value));
          }}
        />
      </div>
    );
  };

  const handleGenerateSpriteSheet = async () => {
    if (uploadedFiles.length === 0) {
      alert("Please upload some images first!");
      return;
    }

    setIsProcessing(true);

    try {
      // Create canvas for sprite sheet
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Step 1: Find the biggest image dimensions first (fast scan)
      console.log("🔍 Step 1: Scanning images for dimensions...");
      let maxWidth = 0;
      let maxHeight = 0;
      const imagePromises: Promise<HTMLImageElement>[] = [];

      for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const file = uploadedFiles[slotIndex];
        if (file) {
          imagePromises.push(loadImage(file.preview!));
        }
      }

      // Load all images in parallel to find max dimensions
      const images = await Promise.all(imagePromises);
      images.forEach((img) => {
        maxWidth = Math.max(maxWidth, img.width);
        maxHeight = Math.max(maxHeight, img.height);
      });

      console.log(
        `✅ Step 1 Complete: Found max dimensions ${maxWidth}x${maxHeight}`
      );

      // Step 2: Use biggest image dimensions for grid cells (with 1080px max limit)
      const MAX_DIMENSION = 1080;
      let tileWidth = maxWidth;
      let tileHeight = maxHeight;

      // Scale down if the longest side exceeds 1080px
      if (Math.max(tileWidth, tileHeight) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(tileWidth, tileHeight);
        tileWidth = Math.floor(tileWidth * scale);
        tileHeight = Math.floor(tileHeight * scale);
        console.log(
          `📏 Scaled down from ${maxWidth}x${maxHeight} to ${tileWidth}x${tileHeight}`
        );
      }

      // Store grid dimensions for display
      setGridDimensions({ width: tileWidth, height: tileHeight });

      // Calculate sprite sheet dimensions
      const sheetWidth = tileWidth * grid.frames;
      const sheetHeight = tileHeight * grid.steps;

      console.log(
        `🎨 Step 2: Setting up canvas ${sheetWidth}x${sheetHeight}...`
      );

      // Set canvas size with high DPI for better quality
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = sheetWidth * devicePixelRatio;
      canvas.height = sheetHeight * devicePixelRatio;
      canvas.style.width = `${sheetWidth}px`;
      canvas.style.height = `${sheetHeight}px`;

      // Scale context for high DPI
      ctx.scale(devicePixelRatio, devicePixelRatio);

      // Enable image smoothing for better quality
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Fill with transparent background
      ctx.clearRect(0, 0, sheetWidth, sheetHeight);

      console.log(`✅ Step 2 Complete: Canvas ready for rendering`);

      // Step 3: Render all images (reuse loaded images, scale to fit biggest)
      console.log("🖼️ Step 3: Rendering images to sprite sheet...");
      let imageIndex = 0;
      let renderedCount = 0;

      for (let slotIndex = 0; slotIndex < totalSlots; slotIndex++) {
        const file = uploadedFiles[slotIndex];
        if (file) {
          const { row, col } = getGridPosition(slotIndex);
          const img = images[imageIndex];
          imageIndex++;

          // Calculate position for this grid cell
          const cellX = col * tileWidth;
          const cellY = row * tileHeight;

          // Scale image to fit within the biggest image's cell size
          const scale = Math.min(
            tileWidth / img.width,
            tileHeight / img.height
          );
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const finalX = cellX + (tileWidth - scaledWidth) / 2;
          const finalY = cellY + (tileHeight - scaledHeight) / 2;

          // Draw image scaled to fit the biggest image's dimensions
          ctx.drawImage(img, finalX, finalY, scaledWidth, scaledHeight);
          renderedCount++;
        }
      }

      console.log(`✅ Step 3 Complete: Rendered ${renderedCount} images`);

      // Step 4: Convert canvas to blob and create preview
      console.log("💾 Step 4: Converting canvas to image...");
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, "image/png");
      });

      // Create preview URL for display
      const previewUrl = URL.createObjectURL(blob);
      setGeneratedSpriteSheet(previewUrl);

      console.log("🎉 Step 4 Complete: Sprite sheet generated successfully!");
    } catch (error) {
      console.error("Error generating sprite sheet:", error);
      alert("Error generating sprite sheet. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  return (
    <section>
      <header>
        <h1>Sprite Sheet Maker</h1>
      </header>
      <main>
        <div>
          <h2>Upload your images</h2>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            style={{ marginBottom: "20px" }}
          />
          <SlotNumber row={grid.steps} col={grid.frames} />

          <div>
            <p>
              Sprite Sheet Grid ({grid.steps}×{grid.frames} = {totalSlots}{" "}
              slots)
              {gridDimensions &&
                ` - Each slot: ${gridDimensions.width}×${gridDimensions.height}px`}{" "}
              - Uploaded {uploadedFiles.length} files (drag to reorder):
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${grid.frames}, 1fr)`,
                gap: "2px",
                marginBottom: "20px",
                border: "2px solid #333",
                padding: "10px",
                backgroundColor: "#f0f0f0",
                maxWidth: "fit-content",
              }}
            >
              {Array.from({ length: totalSlots }, (_, slotIndex) => {
                const file = uploadedFiles[slotIndex];
                const hasFile = !!file;
                const { row, col } = getGridPosition(slotIndex);

                return (
                  <div
                    key={slotIndex}
                    style={{
                      width: "80px",
                      height: "80px",
                      border: hasFile ? "2px solid #4CAF50" : "2px dashed #ccc",
                      borderRadius: "4px",
                      padding: "4px",
                      textAlign: "center",
                      cursor: "move",
                      backgroundColor: hasFile ? "#e8f5e8" : "#f9f9f9",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    draggable={hasFile}
                    onDragStart={(e) => {
                      if (hasFile) {
                        e.dataTransfer.setData(
                          "text/plain",
                          slotIndex.toString()
                        );
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(
                        e.dataTransfer.getData("text/plain")
                      );
                      if (fromIndex !== slotIndex) {
                        // Swap files between slots
                        const newFiles = [...uploadedFiles];
                        const temp = newFiles[fromIndex];
                        newFiles[fromIndex] = newFiles[slotIndex];
                        newFiles[slotIndex] = temp;
                        setUploadedFiles(newFiles);
                      }
                    }}
                  >
                    {hasFile ? (
                      <>
                        <img
                          src={file.preview}
                          alt={file.name}
                          style={{
                            width: "100%",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "2px",
                          }}
                        />
                        <div
                          style={{
                            fontSize: "8px",
                            color: "#666",
                            marginTop: "2px",
                            textAlign: "center",
                            lineHeight: "1",
                          }}
                        >
                          R{row + 1}C{col + 1}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const newFiles = [...uploadedFiles];
                            delete newFiles[slotIndex];
                            setUploadedFiles(newFiles);
                            await calculateGridDimensions(newFiles);
                          }}
                          style={{
                            position: "absolute",
                            top: "-8px",
                            right: "-8px",
                            width: "16px",
                            height: "16px",
                            fontSize: "10px",
                            backgroundColor: "#ff4444",
                            color: "white",
                            border: "none",
                            borderRadius: "50%",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#999",
                          textAlign: "center",
                        }}
                      >
                        Empty
                        <br />R{row + 1}C{col + 1}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleGenerateSpriteSheet}
              disabled={isProcessing}
              style={{
                padding: "10px 20px",
                fontSize: "16px",
                backgroundColor: isProcessing ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
            >
              {isProcessing ? "Processing..." : "Generate Sprite Sheet"}
            </button>
          </div>

          {generatedSpriteSheet && (
            <div style={{ marginTop: "30px" }}>
              <h3>Generated Sprite Sheet</h3>
              <div
                style={{
                  border: "2px solid #333",
                  padding: "10px",
                  backgroundColor: "#f9f9f9",
                  display: "inline-block",
                }}
              >
                <img
                  src={generatedSpriteSheet}
                  alt="Generated Sprite Sheet"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
              </div>
              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = generatedSpriteSheet;
                    a.download = `sprite_sheet_${grid.steps}x${grid.frames}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "10px",
                  }}
                >
                  Download Sprite Sheet
                </button>
                <button
                  onClick={() => {
                    if (generatedSpriteSheet) {
                      URL.revokeObjectURL(generatedSpriteSheet);
                      setGeneratedSpriteSheet(null);
                    }
                  }}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </section>
  );
}

export default App;
