const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;
const ROOM_ID = window.location.hash.substring(1) || 'default-room';

// Elements
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const participantsList = document.getElementById('participants-list');
const muteBtn = document.getElementById('mute-btn');
const videoBtn = document.getElementById('video-btn');
const shareBtn = document.getElementById('share-btn');
const whiteboardBtn = document.getElementById('whiteboard-btn');
const leaveBtn = document.getElementById('leave-btn');
const drawingBoard = document.getElementById('drawing-board');
const whiteboardContainer = document.getElementById('whiteboard');

let myPeerId;
let myStream;
let myPeer;
let peers = {};
let isVideoOn = true;
let isAudioOn = true;

// Initialize PeerJS
const peer = new Peer();

peer.on('open', id => {
    myPeerId = id;
    socket.emit('join-room', ROOM_ID, id);
    addParticipant(id, 'You', true);
});

// Get user media
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myStream = stream;
    addVideoStream(myVideo, stream, true);
    
    peer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream);
            addParticipant(call.peer, `User ${call.peer.substring(0, 5)}`);
        });
    });

    socket.on('user-connected', userId => {
        connectToNewUser(userId, stream);
    });
});

socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
    removeParticipant(userId);
});

// Chat functionality
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        socket.emit('send-message', ROOM_ID, myPeerId, message);
        addMessage(myPeerId, message, true);
        chatInput.value = '';
    }
});

socket.on('receive-message', (userId, message) => {
    addMessage(userId, message, false);
});

// Button controls
muteBtn.addEventListener('click', () => {
    const audioTrack = myStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    isAudioOn = audioTrack.enabled;
    muteBtn.innerHTML = isAudioOn ? '<i class="fas fa-microphone"></i> Mute' : '<i class="fas fa-microphone-slash"></i> Unmute';
    muteBtn.classList.toggle('active');
});

videoBtn.addEventListener('click', () => {
    const videoTrack = myStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    isVideoOn = videoTrack.enabled;
    videoBtn.innerHTML = isVideoOn ? '<i class="fas fa-video"></i> Stop Video' : '<i class="fas fa-video-slash"></i> Start Video';
    videoBtn.classList.toggle('active');
});

shareBtn.addEventListener('click', async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia();
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track with screen share
        const sender = myPeer.getSenders().find(s => s.track.kind === 'video');
        sender.replaceTrack(screenTrack);
        
        screenTrack.onended = () => {
            const videoTrack = myStream.getVideoTracks().find(t => t.kind === 'video');
            sender.replaceTrack(videoTrack);
        };
    } catch (err) {
        console.error('Screen share error:', err);
    }
});

whiteboardBtn.addEventListener('click', () => {
    whiteboardContainer.classList.toggle('hidden');
    if (!whiteboardContainer.classList.contains('hidden')) {
        initWhiteboard();
    }
});

leaveBtn.addEventListener('click', () => {
    if (confirm('Leave the meeting?')) {
        window.location.href = '/';
    }
});

// Helper functions
function connectToNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
        addParticipant(userId, `User ${userId.substring(0, 5)}`);
    });
    peers[userId] = call;
}

function addVideoStream(video, stream, isMe = false) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    if (isMe) {
        video.classList.add('my-video');
    }
    videoGrid.appendChild(video);
}

function addParticipant(userId, name, isMe = false) {
    const participant = document.createElement('div');
    participant.className = 'participant';
    participant.innerHTML = `<i class="fas fa-user"></i> ${name}`;
    participant.id = `participant-${userId}`;
    participantsList.appendChild(participant);
}

function removeParticipant(userId) {
    const participant = document.getElementById(`participant-${userId}`);
    if (participant) participant.remove();
}

function addMessage(userId, message, isMe = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isMe ? 'message my-message' : 'message other-message';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function initWhiteboard() {
    const ctx = drawingBoard.getContext('2d');
    let isDrawing = false;
    
    // Set canvas size
    drawingBoard.width = drawingBoard.offsetWidth;
    drawingBoard.height = drawingBoard.offsetHeight;
    
    // Drawing functions
    drawingBoard.addEventListener('mousedown', startDrawing);
    drawingBoard.addEventListener('mousemove', draw);
    drawingBoard.addEventListener('mouseup', stopDrawing);
    drawingBoard.addEventListener('mouseout', stopDrawing);
    
    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }
    
    function draw(e) {
        if (!isDrawing) return;
        ctx.lineWidth = document.getElementById('brush-size').value;
        ctx.lineCap = 'round';
        ctx.strokeStyle = document.getElementById('color-picker').value;
        
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.offsetX, e.offsetY);
    }
    
    function stopDrawing() {
        isDrawing = false;
        ctx.beginPath();
    }
    
    // Clear button
    document.getElementById('clear-board').addEventListener('click', () => {
        ctx.clearRect(0, 0, drawingBoard.width, drawingBoard.height);
    });
    
    // Close button
    document.getElementById('close-whiteboard').addEventListener('click', () => {
        whiteboardContainer.classList.add('hidden');
    });
}