// Configuración global del juego. Todo lo "configurable" vive aquí.
export const CONFIG = {
  seed: 'voxelia',
  worldChunks: 32,       // mundo de N x N chunks (512 x 512 bloques); se genera y descarga por tramos alrededor del jugador
  renderDistance: 8,     // en chunks
  fov: 70,               // grados
  mouseSensitivity: 0.0022,
  reach: 5,              // distancia máxima de interacción (se usa desde la Fase 3)
  player: {
    walkSpeed: 4.8,
    sprintSpeed: 7.6,
    crouchSpeed: 1.8,
    jumpSpeed: 8.9,
    gravity: 32,
    width: 0.6,
    height: 1.8,
    crouchHeight: 1.5,
    eyeHeight: 1.62,
    crouchEyeHeight: 1.27,
  },
};
