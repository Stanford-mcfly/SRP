import { useEffect, useRef, useState } from 'react';
import Web3 from 'web3';
import * as faceapi from 'face-api.js';
import { create } from "ipfs-http-client";
import contractABI from './SimpleStorage.json';
import idCardImage from "./selfie.jpeg";
import selfieImage from "./vijay.jpeg";

const ipfs = create({ url: "http://127.0.0.1:5001" });
const contractAddress = "0xa8616F949435DdE5815d53C41b95611FE57bC5AD";

function App() {
  const idCardRef = useRef();
  const selfieRef = useRef();
  const [matchResult, setMatchResult] = useState("");
  const [account, setAccount] = useState("");
  const [web3, setWeb3] = useState(null);
  const [contract, setContract] = useState(null);

  useEffect(() => {
    connectToMetaMask();
    loadModels();
  }, []);

  const connectToMetaMask = async () => {
    if (!window.ethereum) {
      setMatchResult("❌ MetaMask is not installed.");
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const web3Instance = new Web3(window.ethereum);
      const accounts = await web3Instance.eth.getAccounts();

      setWeb3(web3Instance);
      setAccount(accounts[0]);

      const contractInstance = new web3Instance.eth.Contract(contractABI.abi, contractAddress);
      setContract(contractInstance);

      console.log("✅ Connected to MetaMask:", accounts[0]);
    } catch (error) {
      console.error("MetaMask connection failed:", error);
      setMatchResult("❌ MetaMask connection failed.");
    }
  };

  const loadModels = async () => {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]);
    console.log("✅ Face API models loaded!");
  };

  const detectFace = async (imageElement, label) => {
    if (!imageElement) return null;

    console.log(`🔍 Detecting face in ${label}...`);
    const detections = await faceapi.detectSingleFace(imageElement)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detections) {
      console.error(`❌ No face detected in ${label}`);
      return null;
    }

    return detections.descriptor;
  };

  const uploadToIPFS = async (descriptor) => {
    try {
      const descriptorArray = Array.from(descriptor);
      const jsonString = JSON.stringify({ descriptor: descriptorArray });
      const base64String = btoa(jsonString);
      const added = await ipfs.add(base64String);

      if (!added || !added.path) throw new Error("Invalid CID from IPFS");

      console.log("✅ IPFS Upload Success:", added.path);
      return added.path;
    } catch (error) {
      console.error("❌ IPFS Upload Error:", error.message);
      return null;
    }
  };

  const registerUser = async () => {
    const idCardDescriptor = await detectFace(idCardRef.current, "ID Card");

    if (!idCardDescriptor) {
      setMatchResult("❌ No face detected in the ID card.");
      return;
    }

    const ipfsHash = await uploadToIPFS(idCardDescriptor);
    if (!ipfsHash) {
      setMatchResult("❌ Failed to upload to IPFS.");
      return;
    }

    const name = prompt("Enter refugee name:");
    if (!name) {
      setMatchResult("❌ Registration cancelled. Name is required.");
      return;
    }

    try {
      await contract.methods.registerRefugee(name, ipfsHash).send({ from: account, gas: 300000 });
      setMatchResult(`✅ Registered! Name: ${name}, IPFS Hash: ${ipfsHash}`);
    } catch (error) {
      console.error("❌ Blockchain Error:", error);
      setMatchResult(`❌ Blockchain Error: ${error.message}`);
    }
  };

  const verifyUser = async () => {
    try {
      const newDescriptor = await detectFace(selfieRef.current, "Selfie");
      if (!newDescriptor) {
        setMatchResult("❌ No face detected in the Selfie.");
        return;
      }

      const faceHashes = await contract.methods.getAllFaceHashes().call();
      if (!faceHashes || faceHashes.length === 0) {
        setMatchResult("❌ No refugees registered.");
        return;
      }

      console.log("🧾 All Face Hashes:", faceHashes);

      let bestMatchHash = null;
      let bestDistance = Infinity;

      for (let hash of faceHashes) {
        const data = await contract.methods.getRefugeeByFaceHash(hash).call();
        const ipfsHash = data[1];

        const ipfsData = await fetchFromIPFS(ipfsHash);
        if (!ipfsData || !ipfsData.descriptor) continue;

        const storedDescriptor = Float32Array.from(ipfsData.descriptor);
        const distance = euclideanDistance(newDescriptor, storedDescriptor);

        console.log(`📏 Distance from ${data[0]}: ${distance.toFixed(4)}`);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatchHash = hash;
        }
      }

      const isMatch = bestDistance < 0.6;

      if (isMatch) {
        const matchedData = await contract.methods.getRefugeeByFaceHash(bestMatchHash).call();
        setMatchResult(`✅ Match Found! Name: ${matchedData[0]} (Distance: ${bestDistance.toFixed(4)})`);
      } else {
        setMatchResult("❌ No Match Found.");
      }

    } catch (error) {
      console.error("❌ Error during verification:", error);
      setMatchResult("❌ Verification failed.");
    }
  };

  const fetchFromIPFS = async (ipfsHash) => {
    try {
      const response = ipfs.cat(ipfsHash);
      let chunks = [];
      for await (const chunk of response) {
        chunks.push(chunk);
      }

      const completeData = new Uint8Array(chunks.reduce((acc, val) => acc.concat(Array.from(val)), []));
      const base64String = new TextDecoder().decode(completeData);
      const jsonString = atob(base64String);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("IPFS Fetch Error:", error);
      return null;
    }
  };

  const euclideanDistance = (arr1, arr2) => {
    return Math.sqrt(arr1.reduce((sum, val, i) => sum + Math.pow(val - arr2[i], 2), 0));
  };

  return (
    <>
      <h2>Account: {account}</h2>
      <button onClick={registerUser}>Register</button>
      <button onClick={verifyUser}>Verify</button>

      <div>
        <h3>ID Card</h3>
        <img ref={idCardRef} src={idCardImage} alt="ID Card" style={{ maxWidth: '300px' }} />
      </div>

      <div>
        <h3>Current Image</h3>
        <img ref={selfieRef} src={selfieImage} alt="Selfie" style={{ maxWidth: '300px' }} />
      </div>

      <h1>{matchResult}</h1>
    </>
  );
}

export default App;
