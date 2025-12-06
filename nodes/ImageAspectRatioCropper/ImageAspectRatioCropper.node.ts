import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';
import sharp from 'sharp';

/**
 * Validate aspect ratio format
 * @param ratio - Aspect ratio string like "16:9"
 * @returns true if valid, false otherwise
 */
function isValidAspectRatio(ratio: string): boolean {
  if (!ratio || typeof ratio !== 'string') return false;
  const match = ratio.match(/^(\d+):(\d+)$/);
  if (!match) return false;
  const [, w, h] = match;
  return parseInt(w, 10) > 0 && parseInt(h, 10) > 0;
}

/**
 * Supported image MIME types
 * Matches n8n's official Edit Image node supported formats
 */
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/svg+xml',
];

/**
 * Output format configuration
 */
const OUTPUT_FORMATS = [
  { name: 'Same as Input', value: 'same' },
  { name: 'JPEG', value: 'jpeg' },
  { name: 'PNG', value: 'png' },
  { name: 'WebP', value: 'webp' },
  { name: 'GIF', value: 'gif' },
  { name: 'TIFF', value: 'tiff' },
];

/**
 * Cover mode center crop algorithm (precise integer calculation)
 *
 * Core principle: Uses cross multiplication for ratio comparison,
 * ensuring output ratio exactly matches the target.
 *
 * @param width - Original image width
 * @param height - Original image height
 * @param aspectRatio - Target ratio string, e.g., "16:9"
 * @returns Crop parameters { needsCrop, cropWidth, cropHeight, positionX, positionY, scale }
 */
function calculateCoverCrop(
  width: number,
  height: number,
  aspectRatio: string
): {
  needsCrop: boolean;
  cropWidth: number;
  cropHeight: number;
  positionX: number;
  positionY: number;
  scale: number | null;
} {
  // Parse target ratio as integer pair
  const [ratioW, ratioH] = aspectRatio.split(':').map(Number);

  // Use cross multiplication to check ratio equality
  // width/height === ratioW/ratioH  is equivalent to  width * ratioH === height * ratioW
  const isExactMatch = width * ratioH === height * ratioW;

  if (isExactMatch) {
    // Ratios match exactly - no crop needed
    return {
      needsCrop: false,
      cropWidth: width,
      cropHeight: height,
      positionX: 0,
      positionY: 0,
      scale: null,
    };
  }

  let scale: number;
  let cropWidth: number;
  let cropHeight: number;

  // Use cross multiplication to determine if original is wider or taller
  // width/height > ratioW/ratioH  is equivalent to  width * ratioH > height * ratioW
  const isWider = width * ratioH > height * ratioW;

  if (isWider) {
    // Original is wider: use height as base, calculate max integer scale
    scale = Math.floor(height / ratioH);
    cropHeight = scale * ratioH;
    cropWidth = scale * ratioW;
  } else {
    // Original is taller: use width as base, calculate max integer scale
    scale = Math.floor(width / ratioW);
    cropWidth = scale * ratioW;
    cropHeight = scale * ratioH;
  }

  // Calculate center position
  const positionX = Math.floor((width - cropWidth) / 2);
  const positionY = Math.floor((height - cropHeight) / 2);

  return {
    needsCrop: true,
    cropWidth,
    cropHeight,
    positionX,
    positionY,
    scale,
  };
}

export class ImageAspectRatioCropper implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Image Aspect Ratio Cropper',
    name: 'imageAspectRatioCropper',
    icon: 'file:ImageAspectRatioCropper.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["aspectRatio"]}}',
    description:
      'Crop images to exact aspect ratios using center-cover mode. Supports JPEG, PNG, WebP, GIF, TIFF, SVG formats.',
    defaults: {
      name: 'Image Aspect Ratio Cropper',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property containing the image data',
      },
      {
        displayName: 'Aspect Ratio',
        name: 'aspectRatio',
        type: 'string',
        default: '16:9',
        required: true,
        placeholder: 'e.g. 16:9, 1:1, 4:3',
        description:
          'Target aspect ratio in W:H format. Common ratios: 1:1 (Square), 16:9 (Widescreen), 9:16 (Phone), 4:3, 3:4, 4:5, 5:4, 2:3, 3:2, 21:9. Supports expressions like {{ $json.aspectRatio }}.',
      },
      {
        displayName: 'Output Format',
        name: 'outputFormat',
        type: 'options',
        options: OUTPUT_FORMATS,
        default: 'same',
        description: 'Output image format. Supports JPEG, PNG, WebP, GIF, and TIFF.',
      },
      {
        displayName: 'JPEG Quality',
        name: 'jpegQuality',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 80,
        displayOptions: {
          show: {
            outputFormat: ['jpeg'],
          },
        },
        description: 'Quality for JPEG output (1-100, default: 80)',
      },
      {
        displayName: 'WebP Quality',
        name: 'webpQuality',
        type: 'number',
        typeOptions: {
          minValue: 1,
          maxValue: 100,
        },
        default: 80,
        displayOptions: {
          show: {
            outputFormat: ['webp'],
          },
        },
        description: 'Quality for WebP output (1-100, default: 80)',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const binaryPropertyName = this.getNodeParameter(
          'binaryPropertyName',
          itemIndex
        ) as string;
        const aspectRatio = this.getNodeParameter(
          'aspectRatio',
          itemIndex
        ) as string;

        // Validate aspect ratio format
        if (!isValidAspectRatio(aspectRatio)) {
          throw new NodeOperationError(
            this.getNode(),
            `Invalid aspect ratio format: "${aspectRatio}". Expected format: W:H (e.g., 16:9, 1:1, 4:3)`,
            { itemIndex }
          );
        }

        const outputFormat = this.getNodeParameter(
          'outputFormat',
          itemIndex
        ) as string;

        const item = items[itemIndex];

        // Validate binary data exists
        if (!item.binary || !item.binary[binaryPropertyName]) {
          throw new NodeOperationError(
            this.getNode(),
            `No binary data found in property "${binaryPropertyName}"`,
            { itemIndex }
          );
        }

        const binaryData = item.binary[binaryPropertyName];
        const mimeType = binaryData.mimeType || '';

        // Validate MIME type
        if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported image format: ${mimeType}. Supported formats: JPEG, PNG, WebP, GIF, TIFF, SVG`,
            { itemIndex }
          );
        }

        // Get binary buffer
        const binaryBuffer = await this.helpers.getBinaryDataBuffer(
          itemIndex,
          binaryPropertyName
        );

        // Get image metadata
        const metadata = await sharp(binaryBuffer).metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;

        if (width === 0 || height === 0) {
          throw new NodeOperationError(
            this.getNode(),
            'Could not determine image dimensions',
            { itemIndex }
          );
        }

        // Calculate crop parameters
        const cropParams = calculateCoverCrop(width, height, aspectRatio);

        let outputBuffer: Buffer;
        let outputMimeType: string;
        let outputExtension: string;

        // Determine output format
        type SupportedFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff';
        let targetFormat: SupportedFormat;

        if (outputFormat === 'same') {
          // Detect format from input MIME type
          if (mimeType.includes('png')) {
            targetFormat = 'png';
          } else if (mimeType.includes('webp')) {
            targetFormat = 'webp';
          } else if (mimeType.includes('gif')) {
            targetFormat = 'gif';
          } else if (mimeType.includes('tiff')) {
            targetFormat = 'tiff';
          } else if (mimeType.includes('svg')) {
            // SVG input converts to PNG output (sharp doesn't support SVG output)
            targetFormat = 'png';
          } else {
            targetFormat = 'jpeg';
          }
        } else {
          targetFormat = outputFormat as SupportedFormat;
        }

        // Set output MIME type and extension
        switch (targetFormat) {
          case 'png':
            outputMimeType = 'image/png';
            outputExtension = 'png';
            break;
          case 'webp':
            outputMimeType = 'image/webp';
            outputExtension = 'webp';
            break;
          case 'gif':
            outputMimeType = 'image/gif';
            outputExtension = 'gif';
            break;
          case 'tiff':
            outputMimeType = 'image/tiff';
            outputExtension = 'tiff';
            break;
          default:
            outputMimeType = 'image/jpeg';
            outputExtension = 'jpg';
        }

        // Process image
        let sharpInstance = sharp(binaryBuffer);

        if (cropParams.needsCrop) {
          // Apply crop
          sharpInstance = sharpInstance.extract({
            left: cropParams.positionX,
            top: cropParams.positionY,
            width: cropParams.cropWidth,
            height: cropParams.cropHeight,
          });
        }

        // Convert to target format
        switch (targetFormat) {
          case 'png':
            outputBuffer = await sharpInstance.png().toBuffer();
            break;
          case 'webp': {
            const webpQuality = this.getNodeParameter(
              'webpQuality',
              itemIndex,
              80
            ) as number;
            outputBuffer = await sharpInstance
              .webp({ quality: webpQuality })
              .toBuffer();
            break;
          }
          case 'gif':
            // Note: Sharp outputs static GIF (first frame only for animated GIFs)
            outputBuffer = await sharpInstance.gif().toBuffer();
            break;
          case 'tiff':
            outputBuffer = await sharpInstance.tiff().toBuffer();
            break;
          default: {
            const jpegQuality = this.getNodeParameter(
              'jpegQuality',
              itemIndex,
              80
            ) as number;
            outputBuffer = await sharpInstance
              .jpeg({ quality: jpegQuality })
              .toBuffer();
          }
        }

        // Generate output filename
        const originalFileName = binaryData.fileName || 'image';
        const baseFileName = originalFileName.replace(/\.[^/.]+$/, '');
        const outputFileName = `${baseFileName}_${aspectRatio.replace(':', 'x')}.${outputExtension}`;

        // Prepare output item
        const newItem: INodeExecutionData = {
          json: {
            aspectRatio,
            cropped: cropParams.needsCrop,
            originalWidth: width,
            originalHeight: height,
            croppedWidth: cropParams.cropWidth,
            croppedHeight: cropParams.cropHeight,
            positionX: cropParams.positionX,
            positionY: cropParams.positionY,
            scale: cropParams.scale,
            message: cropParams.needsCrop
              ? `Image successfully cropped to ${aspectRatio} aspect ratio.`
              : `Image already matches ${aspectRatio} aspect ratio. No crop needed.`,
          },
          binary: {},
          pairedItem: { item: itemIndex },
        };

        // Store output binary
        newItem.binary![binaryPropertyName] =
          await this.helpers.prepareBinaryData(
            outputBuffer,
            outputFileName,
            outputMimeType
          );

        returnData.push(newItem);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

