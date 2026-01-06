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
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const [grid, setGrid] = useState({
    steps: 4,
    frames: 4,
  });
  const [totalSlots, setTotalSlots] = useState(grid.steps * grid.frames);
  // Sprite sheet configuration
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
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
      "total",
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

      // Apply 1920px limit
      const MAX_DIMENSION = 1920;
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
      <div className="slot-number">
        R{row} C{col}
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
        `✅ Step 1 Complete: Found max dimensions ${maxWidth}x${maxHeight}`,
      );

      // Step 2: Use biggest image dimensions for grid cells (with 1920px max limit)
      const MAX_DIMENSION = 1920;
      let tileWidth = maxWidth;
      let tileHeight = maxHeight;

      // Scale down if the longest side exceeds 1920px
      if (Math.max(tileWidth, tileHeight) > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(tileWidth, tileHeight);
        tileWidth = Math.floor(tileWidth * scale);
        tileHeight = Math.floor(tileHeight * scale);
        console.log(
          `📏 Scaled down from ${maxWidth}x${maxHeight} to ${tileWidth}x${tileHeight}`,
        );
      }

      // Store grid dimensions for display
      setGridDimensions({ width: tileWidth, height: tileHeight });

      // Calculate sprite sheet dimensions
      const sheetWidth = tileWidth * grid.frames;
      const sheetHeight = tileHeight * grid.steps;

      console.log(
        `🎨 Step 2: Setting up canvas ${sheetWidth}x${sheetHeight}...`,
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
            tileHeight / img.height,
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
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <h1>Sprite Sheet Maker</h1>
          <button
            className="info-btn"
            onClick={() => setShowInfoOverlay(true)}
            title="Information about Sprite Sheet Maker"
          >
            ℹ️
          </button>
        </div>
      </header>
      <main className="main">
        <div className="file-upload-section">
          <h2>Upload your images</h2>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="file-input"
          />
          <SlotNumber row={grid.steps} col={grid.frames} />

          <div className="grid-config">
            <p className="grid-info">
              Sprite Sheet Grid ({grid.steps}×{grid.frames} = {totalSlots}{" "}
              slots)
              {gridDimensions &&
                ` - slot size: ${gridDimensions.width}×${gridDimensions.height}px`}{" "}
              - Used {uploadedFiles.filter((file) => file).length} of{" "}
              {totalSlots} slots (drag to reorder):
            </p>
            <div
              className="sprite-grid"
              style={{
                gridTemplateColumns: `repeat(${grid.frames}, 1fr)`,
              }}
            >
              {Array.from({ length: totalSlots }, (_, slotIndex) => {
                const file = uploadedFiles[slotIndex];
                const hasFile = !!file;
                const { row, col } = getGridPosition(slotIndex);

                return (
                  <div
                    key={slotIndex}
                    className={`grid-slot ${hasFile ? "filled" : "empty"}`}
                    draggable={hasFile}
                    onDragStart={(e) => {
                      if (hasFile) {
                        e.dataTransfer.setData(
                          "text/plain",
                          slotIndex.toString(),
                        );
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIndex = parseInt(
                        e.dataTransfer.getData("text/plain"),
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
                          className="slot-image"
                        />
                        <div className="slot-position">
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
                          className="slot-remove-btn"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div className="empty-slot-text">
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
              className={`btn btn-primary ${isProcessing ? "processing" : ""}`}
            >
              {isProcessing ? "Processing..." : "Generate Sprite Sheet"}
            </button>
          </div>

          {generatedSpriteSheet && (
            <div className="sprite-sheet-section">
              <h3 className="sprite-sheet-title">Generated Sprite Sheet</h3>
              <div className="sprite-sheet-preview">
                <img
                  src={generatedSpriteSheet}
                  alt="Generated Sprite Sheet"
                  className="sprite-sheet-image"
                />
              </div>
              <div className="sprite-sheet-actions">
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = generatedSpriteSheet;
                    a.download = `sprite_sheet_${grid.steps}x${grid.frames}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="btn btn-success"
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
                  className="btn btn-danger"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Information Overlay */}
      {showInfoOverlay && (
        <div className="overlay" onClick={() => setShowInfoOverlay(false)}>
          <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="overlay-header">
              <h2>Sprite Sheet Maker Information</h2>
              <button
                className="close-btn"
                onClick={() => setShowInfoOverlay(false)}
              >
                ×
              </button>
            </div>
            <div className="overlay-body">
              <p>
                The Sprite Sheet Maker allows you to create customizable sprite
                sheets for various uses. However, there are some important
                limitations to understand:
              </p>

              <div className="info-section">
                <h3>How it works:</h3>
                <ul>
                  <li>All slots in the grid are the same size</li>
                  <li>
                    The slot size is determined by the biggest image you upload
                  </li>
                  <li>Smaller images are centered within their slots</li>
                  <li>Larger images are scaled down to fit the slot size</li>
                </ul>
              </div>

              <div className="info-section">
                <h3>Size limitations:</h3>
                <ul>
                  <li>
                    If an image has a side longer than 1920px, it will be
                    resized to fit
                  </li>
                  <li>Images that don't exceed 1920px will not be resized</li>
                  <li>The final sprite sheet maintains aspect ratios</li>
                  <li>Empty slots remain transparent in the final output</li>
                </ul>
              </div>

              <div className="info-section">
                <h3>Best practices:</h3>
                <ul>
                  <li>Use images of similar sizes for best results</li>
                  <li>Consider the final grid layout when arranging images</li>
                  <li>
                    Larger images will determine the overall sprite sheet size
                  </li>
                  <li>
                    You can drag and drop to reorder images before generating
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
