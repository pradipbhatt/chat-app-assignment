let instance = null;

export function setIo(io) {
  instance = io;
}

export function getIo() {
  return instance;
}
