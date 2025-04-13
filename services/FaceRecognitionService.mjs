import { createCanvas, loadImage, Canvas, Image, ImageData } from 'canvas';
import * as faceapi from 'face-api.js';

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

class FaceRecognitionService {
  static async initializeFaceAPI(modelsPath) {
    try {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(`${modelsPath}/ssd_mobilenetv1`);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(`${modelsPath}/face_landmark_68`);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(`${modelsPath}/face_recognition`);
      console.log('Face models loaded successfully');
    } catch (err) {
      throw new Error(`Face model loading failed: ${err.message}`);
    }
  }

  static async detectFace(imageBase64) {
    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const img = await loadImage(buffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const detection = await faceapi.detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor();

      return detection ? Array.from(detection.descriptor).slice(0, 5) : null;
    } catch (err) {
      throw new Error(`Face detection failed: ${err.message}`);
    }
  }
}

export default FaceRecognitionService;