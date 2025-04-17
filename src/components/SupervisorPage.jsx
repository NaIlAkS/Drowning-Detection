import React, { useEffect, useState } from "react";
import { Modal, Button, Table } from "react-bootstrap";
import io from "socket.io-client";
import axios from "axios";
import "./SupervisorPage.css";

const socket = io.connect("http://127.0.0.1:5001");

// ✅ Use Public Folder Path for Alert Sound
const drowningAlertSound = new Audio("/danger_warning.mp3");

const SupervisorPage = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [alertLogs, setAlertLogs] = useState([]); // ✅ State for alert logs

  // ✅ WebSocket: Handle Video Upload & Drowning Alert Events
  useEffect(() => {
    socket.on("videoUploaded", (data) => {
      setVideoId(data.videoId);
      console.log("✅ Video uploaded:", data.videoId);
    });

    socket.on("drowningAlert", (data) => {
      setVideoId(data.videoId);
      console.log("🚨 Drowning Alert Received!", data);

      // ✅ Play Alert Sound after 2 seconds
      setTimeout(() => {
        drowningAlertSound.play().catch((err) => console.error("🔊 Error playing sound:", err));
      }, 2000);

      // ✅ Show Modal (Confirmation)
      setShowConfirmation(true);
    });

    return () => {
      socket.off("videoUploaded");
      socket.off("drowningAlert");
    };
  }, []);

  // ✅ Fetch Alert Logs from Backend
  const fetchAlertLogs = async () => {
    try {
      const response = await axios.get("http://localhost:5001/alerts");
      setAlertLogs(response.data);
      console.log("✅ Alert Logs Fetched:", response.data);
    } catch (error) {
      console.error("❌ Failed to fetch alert logs:", error);
    }
  };

  useEffect(() => {
    fetchAlertLogs(); // ✅ Fetch logs on page load

    // ✅ Listen for real-time alerts via WebSocket
    socket.on("lifeguardAlert", () => {
      console.log("📡 New Alert Received! Updating logs...");
      fetchAlertLogs(); // ✅ Fetch new logs when an alert is sent
    });

    return () => {
      socket.off("lifeguardAlert");
    };
  }, []);

  // ✅ Handle File Selection
  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  // ✅ Handle File Upload & Drowning Detection
  const handleUpload = async () => {
    if (!selectedFile) {
      alert("❌ Please select a video file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("video", selectedFile);
    setIsUploading(true);

    try {
      const response = await axios.post("http://localhost:4050/supervisor/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { message, videoId } = response.data;
      setVideoId(videoId);
      alert(message);

      console.log("📡 Sending video ID:", videoId);
      const detectResponse = await axios.post(
        "http://127.0.0.1:5001/detect",
        { videoId },
        { headers: { "Content-Type": "application/json" } }
      );

      if (detectResponse.data.stream_url) {
        console.log("✅ Stream URL:", detectResponse.data.stream_url);
        setStreamUrl(detectResponse.data.stream_url);
      }
    } catch (error) {
      console.error("❌ Upload/Detection failed:", error.response?.data || error.message);
      alert("❌ Upload/Detection failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // ✅ Handle Confirming & Sending Alert
  const handleConfirmAlert = async () => {
    try {
      const supervisorId = localStorage.getItem("supervisorId"); // ✅ Get stored supervisor ID

      if (!supervisorId) {
        alert("❌ Supervisor ID not found, please login again.");
        return;
      }

      console.log("📡 Sending alert with Supervisor ID:", supervisorId);

      const response = await axios.post("http://localhost:5001/alerts", {
        videoId,
        supervisorId,
      });

      console.log("✅ Alert Sent Response:", response.data);

      // ✅ Emit WebSocket Event to Notify Lifeguard
      socket.emit("lifeguardAlert", { videoId });

      alert("✅ Alert Sent to Lifeguard!");
      setShowConfirmation(false); // ✅ Close modal on success

      fetchAlertLogs(); // ✅ Refresh alert logs after sending alert
    } catch (error) {
      console.error("❌ Failed to send alert:", error.response?.data || error.message);
      alert("❌ Error sending alert! Check backend logs.");
    }
  };

  return (
    <div className="supervisor-container">
      <h1 className="supervisor-heading">Hello, Supervisor! 👋</h1>

      {/* Video Upload Section */}
      <div className="upload-container">
        <h2>Upload a Video</h2>
        <label htmlFor="file-upload" className="choose-file-button">
        <i className="fas fa-folder-open"></i>  Choose a Video
        </label>
        <input type="file" id="file-upload" accept="video/*" onChange={handleFileChange} hidden />
        {selectedFile && <p className="file-name">📂 {selectedFile.name}</p>}

        <button className="upload-button" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? "Uploading..." : "Upload Video"}
        </button>
      </div>

      {/* Show Live Processed Video with Bounding Boxes */}
      {streamUrl && (
        <div className="video-preview">
          <h3>Live Detection:</h3>
          <img src={streamUrl} alt="Live Detection" width="600" />
        </div>
      )}

      {/* ✅ Alert Logs Section */}
      <div className="alert-logs">
        <h2>🚨 Alert Logs</h2>
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>Supervisor ID</th>
              <th>Video ID</th>
              <th>Lifeguard ID</th>
            </tr>
          </thead>
          <tbody>
            {alertLogs.length > 0 ? (
              alertLogs.map((log, index) => (
                <tr key={log.id}>
                  <td>{index + 1}</td>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td>{log.supervisor_id}</td>
                  <td>{log.video_id}</td>
                  <td>{log.lifeguard_id || "N/A"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">No alerts yet.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* ✅ Drowning Alert Modal */}
      <Modal show={showConfirmation} onHide={() => {}} backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>🚨 Drowning Alert</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Drowning detected in video {videoId}! Confirm and send alert?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={handleConfirmAlert}>
            Yes, Send Alert
          </Button>
          <Button variant="secondary" onClick={() => setShowConfirmation(false)}>
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SupervisorPage;