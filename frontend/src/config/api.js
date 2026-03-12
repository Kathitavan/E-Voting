const LOCAL_API = "http://127.0.0.1:5000"
const RENDER_API = "https://e-voting-backend-zmxj.onrender.com"

export const API = process.env.REACT_APP_ENV === "local"
  ? LOCAL_API
  : RENDER_API