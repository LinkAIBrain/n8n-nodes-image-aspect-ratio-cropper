# n8n-nodes-image-aspect-ratio-cropper

[![npm version](https://badge.fury.io/js/n8n-nodes-image-aspect-ratio-cropper.svg)](https://badge.fury.io/js/n8n-nodes-image-aspect-ratio-cropper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![n8n community](https://img.shields.io/badge/n8n-community%20node-orange)](https://docs.n8n.io/integrations/community-nodes/)

An n8n community node for cropping images to exact aspect ratios using **center-cover mode**. Mathematically precise algorithm ensures pixel-perfect output.

![Image Aspect Ratio Cropper](https://img.shields.io/badge/Node-Image%20Aspect%20Ratio%20Cropper-blue)

## Features

- 🎯 **Pixel-Perfect Cropping** — Integer-based algorithm guarantees exact aspect ratio output
- 📐 **Flexible Ratios** — Supports any custom ratio (e.g., `16:9`, `1:1`, `4:3`, `7:5`)
- 🖼️ **Multiple Formats** — JPEG, PNG, WebP, GIF, TIFF, SVG support
- ⚡ **Smart Detection** — Automatically skips cropping if image already matches target ratio
- 🔄 **Batch Processing** — Process multiple images in a single execution
- 📊 **Rich Metadata** — Returns detailed crop information for downstream nodes
- 💡 **Expression Support** — Dynamic aspect ratio via n8n expressions

## Installation

### n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-image-aspect-ratio-cropper`
4. Agree to the risks and select **Install**

### Self-hosted n8n

```bash
cd ~/.n8n/custom
npm install n8n-nodes-image-aspect-ratio-cropper
```

Restart n8n after installation.

## Operations

This node provides a single operation: **crop images to a specified aspect ratio using center-cover mode**.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| Binary Property | String | ✅ | `data` | Name of the binary property containing the image |
| Aspect Ratio | String | ✅ | `16:9` | Target aspect ratio in `W:H` format |
| Output Format | Options | | `Same as Input` | Output image format |
| JPEG Quality | Number | | `80` | Quality for JPEG output (1-100) |
| WebP Quality | Number | | `80` | Quality for WebP output (1-100) |

### Aspect Ratio

The aspect ratio parameter accepts any valid `W:H` format and **supports n8n expressions**:

```javascript
// Static values
16:9
1:1
4:3

// Dynamic from previous node
{{ $json.aspectRatio }}

// Conditional expression
{{ $json.platform === 'instagram' ? '4:5' : '16:9' }}
```

**Common Ratios:**

| Ratio | Use Case |
|-------|----------|
| `1:1` | Square — Instagram posts, avatars |
| `4:5` | Portrait — Instagram recommended |
| `9:16` | Vertical — TikTok, Reels, Stories |
| `16:9` | Landscape — YouTube, presentations |
| `4:3` | Traditional — displays, photos |
| `3:2` | Classic — 35mm photography |
| `21:9` | Ultrawide — cinematic |

### Supported Formats

| Format | Input | Output | Notes |
|--------|:-----:|:------:|-------|
| JPEG | ✅ | ✅ | Quality configurable (default: 80) |
| PNG | ✅ | ✅ | Lossless compression |
| WebP | ✅ | ✅ | Quality configurable (default: 80) |
| GIF | ✅ | ✅ | Static frame only |
| TIFF | ✅ | ✅ | Lossless |
| SVG | ✅ | → PNG | Converts to PNG on output |

## Output

### Binary Data

The cropped image is returned in the specified binary property with an auto-generated filename:
```
original_16x9.jpg
```

### JSON Metadata

```json
{
  "aspectRatio": "16:9",
  "cropped": true,
  "originalWidth": 1920,
  "originalHeight": 1440,
  "croppedWidth": 1920,
  "croppedHeight": 1080,
  "positionX": 0,
  "positionY": 180,
  "scale": 120,
  "message": "Image successfully cropped to 16:9 aspect ratio."
}
```

| Field | Description |
|-------|-------------|
| `aspectRatio` | Target aspect ratio used |
| `cropped` | `true` if image was cropped, `false` if already matched |
| `originalWidth/Height` | Original image dimensions |
| `croppedWidth/Height` | Output image dimensions |
| `positionX/Y` | Crop start position (top-left corner) |
| `scale` | Integer scale factor used in calculation |
| `message` | Human-readable result description |

## How It Works

### Center-Cover Algorithm

The node uses a **mathematically precise integer-based algorithm**:

1. **Ratio Comparison** — Uses cross-multiplication to avoid floating-point errors:
   ```
   width × ratioH === height × ratioW
   ```

2. **Scale Calculation** — Finds the largest integer scale that fits within the original dimensions

3. **Center Positioning** — Calculates exact pixel positions to center the crop area

4. **Guaranteed Precision** — Output dimensions are always exact multiples of the target ratio

### Example

Cropping a 1920×1440 image to 16:9:

```
Original: 1920 × 1440
Target: 16:9

Is wider? 1920 × 9 > 1440 × 16 → 17280 > 23040 → No (taller)

Scale = floor(1920 / 16) = 120
CropWidth = 120 × 16 = 1920
CropHeight = 120 × 9 = 1080

PositionX = (1920 - 1920) / 2 = 0
PositionY = (1440 - 1080) / 2 = 180

Result: 1920×1080 cropped from position (0, 180) ✓
```

## Example Workflows

### Basic Usage

```
[HTTP Request] → [Image Aspect Ratio Cropper] → [Write Binary File]
                        ↓
              aspectRatio: "16:9"
              outputFormat: "jpeg"
              jpegQuality: 85
```

### Dynamic Ratio from Data

```
[Webhook] → [Image Aspect Ratio Cropper] → [S3 Upload]
                    ↓
          aspectRatio: {{ $json.ratio }}
```

### Multi-Platform Export

```
                    ┌→ [Cropper: 1:1] → [Instagram]
[Read Binary Files] ├→ [Cropper: 16:9] → [YouTube]
                    └→ [Cropper: 9:16] → [TikTok]
```

## Use Cases

- **AI Image Generation** — Pre-process images for AI models requiring specific aspect ratios
- **Social Media Automation** — Batch crop images for different platforms
- **E-commerce** — Standardize product images to consistent dimensions
- **Video Production** — Generate thumbnails and cover images
- **Photography Workflows** — Crop photos for print sizes

## Compatibility

| Requirement | Version |
|-------------|---------|
| n8n | ≥ 1.0.0 |
| Node.js | ≥ 18.0.0 |

**Platforms:** Linux, macOS, Windows

## Development

```bash
# Clone repository
git clone https://github.com/LinkAIBrain/n8n-nodes-image-aspect-ratio-cropper.git
cd n8n-nodes-image-aspect-ratio-cropper

# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Local testing
npm link
cd ~/.n8n/custom
npm link n8n-nodes-image-aspect-ratio-cropper
# Restart n8n
```

## Dependencies

| Package | Purpose |
|---------|---------|
| [sharp](https://sharp.pixelplumbing.com/) | High-performance image processing |

## License

[MIT](LICENSE)

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [sharp Documentation](https://sharp.pixelplumbing.com/)
