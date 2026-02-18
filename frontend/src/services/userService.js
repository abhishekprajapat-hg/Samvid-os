import api from "./api";

export const getUsers = async () => {
  const res = await api.get("/users");
  return res.data;
};

export const createUser = async (payload) => {
  const res = await api.post("/users/create", payload);
  return res.data;
};

export const rebalanceExecutives = async () => {
  const res = await api.post("/users/rebalance-executives");
  return res.data;
};

export const deleteUser = async (userId) => {
  const res = await api.delete(`/users/${userId}`);
  return res.data;
};
