import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import eventsRouter from './routes/events.js'
import camerasRouter from './routes/cameras.js'
import { initWebSocket } from './websocket/socket.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)

// Configuration CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json())

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/events', eventsRouter)
app.use('/api/cameras', camerasRouter)

// Initialiser WebSocket
const io = new Server(httpServer, {
  cors: corsOptions,
})

initWebSocket(io)

// Rendre io accessible dans les routes via app.locals
app.locals.io = io

const PORT = process.env.PORT || 8000

httpServer.listen(PORT, () => {
  console.log(`🚀 Serveur backend démarré sur le port ${PORT}`)
  console.log(`📡 WebSocket disponible sur ws://localhost:${PORT}`)
  console.log(`🌐 CORS activé pour: ${process.env.CORS_ORIGIN}`)
})
