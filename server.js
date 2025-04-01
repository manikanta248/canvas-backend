const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express();
const PORT = 5000;

app.use(bodyParser.json({ limit: '10mb' })); // Increase the limit to 10MB
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

mongoose.connect('mongodb+srv://sangamkarmanikanta:manigsn123@cluster0.viekwio.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const canvasSchema = new mongoose.Schema({
    uid: String,
    elements: Array,
    canvas: {
        width: Number,
        height: Number,
    },
});

const Canvas = mongoose.model('Canvas', canvasSchema);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', 
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('sendFeedback', async ({ canvasId, feedback }) => {
        try {
            const canvas = await Canvas.findById(canvasId);
            if (!canvas) {
                console.error(`Canvas with ID ${canvasId} not found.`);
                return;
            }

            const elementIndex = feedback.elementIndex;
            if (!canvas.elements[elementIndex]) {
                console.error(`Element at index ${elementIndex} not found in canvas.`);
                return;
            }

            const feedbackIndex = canvas.elements[elementIndex].feedbacks.findIndex(
                (f) => f.feedback === feedback.data.feedback
            );

            if (feedbackIndex !== -1) {
                canvas.elements[elementIndex].feedbacks[feedbackIndex] = feedback.data;
            } else {
                canvas.elements[elementIndex].feedbacks.push(feedback.data);
            }

            await canvas.save();

            io.emit('feedbackUpdated', { canvasId, elements: canvas.elements });
            console.log(`Feedback updated and broadcasted for canvas ID: ${canvasId}`);
        } catch (error) {
            console.error('Error updating feedback:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });
});

app.post('/api/canvas', async (req, res) => {
    try {
        const { canvasData, id } = req.body;

        if (id) {
            const updatedCanvas = await Canvas.findByIdAndUpdate(id, canvasData, { new: true });
            if (!updatedCanvas) {
                return res.status(404).json({ message: 'Canvas not found' });
            }
            return res.status(200).json({ message: 'Canvas updated successfully', id: updatedCanvas._id });
        } else {
            const newCanvas = new Canvas(canvasData);
            const savedCanvas = await newCanvas.save();
            return res.status(201).json({ message: 'Canvas saved successfully', id: savedCanvas._id });
        }
    } catch (error) {
        console.error('Error processing canvas:', error);
        res.status(500).send('Failed to process canvas');
    }
});

app.get('/api/fetch-canvas', async (req, res) => {
    try {
        const canvases = await Canvas.find(); 
        res.status(200).json(canvases);
    } catch (error) {
        console.error('Error fetching canvases:', error);
        res.status(500).send('Failed to fetch canvases');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});