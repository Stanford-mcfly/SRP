# 🌍 Refugee Biometric Management System

A decentralized application (DApp) for managing refugee biometric data securely using blockchain, IPFS, and advanced cryptographic techniques. This project ensures privacy, immutability, and transparency in refugee registration and verification processes.

---

## 🚀 Tech Stack

| Technology       | Purpose                                                                 |
|-------------------|-------------------------------------------------------------------------|
| **Node.js**       | Backend server for handling API requests.                             |
| **Express.js**    | Web framework for building RESTful APIs.                              |
| **Web3.js**       | Interact with the Ethereum blockchain and smart contracts.            |
| **Solidity**      | Smart contract development for secure data storage and verification.  |
| **IPFS (Helia)**  | Decentralized storage for biometric and personal data.                |
| **Face-api.js**   | Face recognition and feature extraction.                              |
| **Circomlibjs**   | Cryptographic library for generating zero-knowledge proofs.           |
| **QR Code**       | Generate QR codes for refugee verification.                           |
| **Canvas**        | Image processing for face detection.                                  |

---

## 🌟 Features

- **Decentralized Storage**: Refugee data is stored on IPFS for immutability and security.
- **Biometric Registration**: Face recognition and feature extraction for unique identification.
- **Zero-Knowledge Proofs**: Privacy-preserving verification of biometric data.
- **Blockchain Integration**: Immutable records of refugee data on Ethereum.
- **QR Code Generation**: Easy verification using QR codes.

---

## 📜 Flow of Events

1. **Registration**:
   - A refugee's face is scanned, and a unique embedding is generated using `face-api.js`.
   - A fuzzy hash is created using Poseidon hashing.
   - The biometric data is encrypted and stored on IPFS.
   - A blockchain transaction is made to register the refugee with their fuzzy hash, IPFS CID, and a commitment.

2. **Verification**:
   - A QR code is scanned to retrieve the refugee's ID.
   - The blockchain is queried to fetch the refugee's IPFS CID.
   - The encrypted data is retrieved from IPFS and decrypted.
   - The decrypted data is compared with the provided biometric data for verification.

3. **Marking as Suspect**:
   - An officer can mark a refugee as a suspect and update their IPFS CID with new evidence.

---

## 🛠️ Setup Guidelines

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Ganache or any Ethereum-compatible blockchain
- IPFS (Helia)
- Python (for face-api.js dependencies)

### Steps

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-repo/SRP.git
   cd SRP
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the root directory with the following:
   ```env
   PROVIDER_URL=http://localhost:7545
   CONTRACT_ADDRESS=0xYourContractAddress
   OFFICER_ADDRESS=0xYourOfficerAddress
   ```

4. **Compile and Deploy Smart Contract**:
   - Navigate to the `contracts` folder.
   - Use Truffle or Hardhat to compile and deploy the `RefugeeBiometric.sol` contract.
   - Update the `CONTRACT_ADDRESS` in the `.env` file with the deployed contract address.

5. **Download Face Models**:
   - Place the required face models (`ssd_mobilenetv1`, `face_landmark_68`, `face_recognition`) in the `models` folder.

6. **Start the Server**:
   ```bash
   npm start
   ```

7. **Access the Application**:
   - API Base URL: `http://localhost:3000`
   - Example Endpoints:
     - `POST /register`: Register a refugee.
     - `GET /verify/:id`: Verify a refugee.
     - `GET /refugees`: List all refugees.

---

## 📂 Project Structure

```
SRP/
├── contracts/               # Solidity smart contracts
├── models/                  # Face recognition models
├── routes/                  # API route handlers
├── services/                # Utility services (e.g., FaceRecognitionService)
├── blockstore/              # IPFS blockstore
├── build/                   # Compiled contract artifacts
├── main.mjs                 # Main server file
├── README.md                # Project documentation
└── .env                     # Environment variables
```

---

## 🧑‍💻 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

---


## 🎉 Acknowledgments

- [Face-api.js](https://github.com/justadudewhohacks/face-api.js)
- [IPFS](https://ipfs.io/)
- [Web3.js](https://web3js.readthedocs.io/)
- [Circomlibjs](https://github.com/iden3/circomlibjs)

---