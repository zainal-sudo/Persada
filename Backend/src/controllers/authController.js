const authService = require("../services/authService");

const getCabang = async (req, res) => {
  try {
    const data = await authService.getCabang();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res
        .status(400)
        .json({
          success: false,
          message: "Username dan password wajib diisi.",
        });

    const data = await authService.login(username, password);
    res.status(200).json({ success: true, data });
  } catch (error) {
    const status = error.status || 401;
    res.status(status).json({ success: false, message: error.message });
  }
};

const me = (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword)
      return res
        .status(400)
        .json({ success: false, message: "Password lama wajib diisi." });
    if (!newPassword)
      return res
        .status(400)
        .json({ success: false, message: "Password baru wajib diisi." });
    if (newPassword !== confirmPassword)
      return res
        .status(400)
        .json({ success: false, message: "Konfirmasi password tidak cocok." });

    const userKode = req.user?.kode;
    if (!userKode)
      return res.status(401).json({ success: false, message: "Unauthorized." });

    await authService.changePassword(userKode, oldPassword, newPassword);
    res.json({ success: true, message: "Password berhasil diganti." });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// DEBUG sementara — lihat header client cert yang benar-benar diterima Node.
const clientDn = async (req, res) => {
  const raw =
    req.headers["ssl_client_s_dn"] ||
    req.headers["ssl-client-s-dn"] ||
    req.headers["SSL_CLIENT_S_DN"] ||
    null;
  res.json({ raw, allHeaderKeys: Object.keys(req.headers) });
};

const getUsers = async (req, res) => {
  try {
    const data = await authService.getUsers();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, me, changePassword, getCabang, getUsers, clientDn };
