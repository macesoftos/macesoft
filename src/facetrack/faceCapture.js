let modelsReady;

const CAPTURE_PROMPTS = [
  "Look straight at the camera…",
  "Turn your head slightly left…",
  "Turn your head slightly right…",
];

function pause(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function loadFaceRecognitionModels() {
  if (!modelsReady) {
    modelsReady = import("face-api.js").then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/facetrack-models"),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri("/facetrack-models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/facetrack-models"),
      ]);
      return faceapi;
    }).catch((error) => {
      modelsReady = null;
      throw error;
    });
  }
  return modelsReady;
}

function faceLuminance(video, box) {
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const width = Math.min(video.videoWidth - left, box.width);
  const height = Math.min(video.videoHeight - top, box.height);
  if (width <= 0 || height <= 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, left, top, width, height, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    total += 0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2];
  }
  return total / (pixels.length / 4);
}

function poseOffset(landmarks, box) {
  const positions = landmarks?.positions;
  if (!positions || positions.length < 31) return 0;
  const leftJaw = positions[0];
  const noseTip = positions[30];
  const rightJaw = positions[16];
  return (noseTip.x - ((leftJaw.x + rightJaw.x) / 2)) / Math.max(box.width, 1);
}

export async function captureFaceSamples(faceapi, video, onPrompt, { count = 3 } = {}) {
  for (let attempt = 0; attempt < 20 && (!video?.videoWidth || !video?.videoHeight); attempt += 1) await pause(100);
  if (!video?.videoWidth || !video?.videoHeight) {
    throw new Error("The camera is still starting. Wait a moment and try again.");
  }

  const descriptors = [];
  const centers = [];
  const poses = [];
  for (let index = 0; index < count; index += 1) {
    onPrompt(CAPTURE_PROMPTS[index % CAPTURE_PROMPTS.length]);
    await pause(400);
    let captured = null;
    for (let attempt = 0; attempt < 8 && !captured; attempt += 1) {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors();
      const clearFaces = detections.filter((face) => face.detection.score >= 0.62);
      if (clearFaces.length > 1) {
        throw new Error("More than one person is in view. Ask others to step away and scan again.");
      }
      if (clearFaces.length === 1) {
        const face = clearFaces[0];
        const box = face.detection.box;
        const centerX = (box.x + box.width / 2) / video.videoWidth;
        const centerY = (box.y + box.height / 2) / video.videoHeight;
        const minimumWidth = Math.max(72, video.videoWidth * 0.09);
        const luminance = faceLuminance(video, box);
        if (box.width < minimumWidth) {
          onPrompt("Move a little closer so your face fills the oval…");
        } else if (centerX < 0.25 || centerX > 0.75 || centerY < 0.12 || centerY > 0.88) {
          onPrompt("Center your whole face inside the oval…");
        } else if (luminance !== null && luminance < 35) {
          onPrompt("The image is too dark. Face the light and try again…");
        } else if (luminance !== null && luminance > 238) {
          onPrompt("The image is too bright. Move away from direct light and try again…");
        } else {
          captured = face;
        }
      } else {
        onPrompt("Keep one well-lit face fully visible inside the oval…");
      }
      if (!captured) await pause(180);
    }
    if (!captured) throw new Error("FaceTrack could not get a clear face sample. Adjust the lighting and position, then try again.");
    descriptors.push(Array.from(captured.descriptor));
    centers.push(captured.detection.box.x + captured.detection.box.width / 2);
    poses.push(poseOffset(captured.landmarks, captured.detection.box));
  }

  const movement = Math.max(...centers) - Math.min(...centers);
  const headTurn = Math.max(...poses) - Math.min(...poses);
  if (movement < 3 && headTurn < 0.025) {
    throw new Error("Turn your head slightly left and right when prompted, then try again.");
  }
  return descriptors;
}
