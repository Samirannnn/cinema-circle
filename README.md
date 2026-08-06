# Watch Party Hub

Build a modern, production-ready full-stack web application called "CineTogether" that allows multiple users to watch movies together in synchronized playback while optionally seeing and hearing each other through WebRTC video and audio.

Tech Stack:

- Frontend: Next.js (React), TypeScript, Tailwind CSS, Framer Motion

- Backend: Node.js, Express.js, Socket.io

- Database: PostgreSQL with Prisma ORM

- Authentication: JWT + Google OAuth

- File Storage: AWS S3

- Cache: Redis

- Deployment-ready with Docker

Core Features:

1. Beautiful Netflix-inspired landing page.

2. User authentication (Google + Email/Password).

3. User profile with avatar.

4. Create public or private watch rooms.

5. Share room invite links.

6. Join existing rooms via room code.

7. Synchronized movie playback using Socket.io (Play, Pause, Seek, Playback Speed).

8. Integrated WebRTC for optional webcam and microphone.

9. Responsive video grid that automatically adjusts as users join or leave.

10. Live text chat with timestamps and emojis.

11. Toggle camera and microphone.

12. Raise hand and emoji reactions.

13. Host controls to play, pause, seek, skip, and transfer host privileges.

14. Display participants list and online status.

15. Dark theme with smooth animations.

16. Responsive design for desktop, tablet, and mobile.

Backend Requirements:

- JWT authentication

- REST APIs for users, rooms, and messages

- Socket.io event handling

- Redis adapter for Socket.io scalability

- Prisma schema

- PostgreSQL database

- Modular folder structure

- Error handling and validation

- Secure middleware (Helmet, CORS, rate limiting)

Frontend Requirements:

- Clean component architecture

- Reusable UI components

- Loading skeletons

- Toast notifications

- Responsive layouts

- Elegant animations

- Modern typography and gradients

WebRTC Requirements:

- Peer-to-peer video and audio

- STUN server configuration

- Camera and microphone permissions

- Dynamic participant grid

- Automatic reconnection

- Screen sharing support

Movie Player:

- HLS streaming support

- Progress synchronization

- Subtitle support

- Fullscreen mode

- Picture-in-picture

- Volume control

- Playback speed

- Keyboard shortcuts

Additional Features:

- Friends system

- Notifications

- Watch history

- AI movie recommendations placeholder

- Admin dashboard

- Analytics dashboard

- User settings

- Theme switcher

Deliverables:

- Complete production-ready frontend and backend

- Clean folder structure

- Well-documented code

- Docker configuration

- Environment variable templates

- Prisma schema

- API documentation

- Socket.io event documentation

- Responsive UI

- Sample data

- README with setup instructions

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52c24d48-cfe2-4817-bfb2-ae300f653e69).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
