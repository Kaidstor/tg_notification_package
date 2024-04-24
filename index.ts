export const sendNotification = (url: string, payload: IMsgPayload) => {

   payload = {
      ...payload,
      type: payload.type || "warning",
   }

  return fetch(url + "/api/send/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export type IMsgType = "info" | "warning" | "unhandled" | "fatal";

export type IMsgPayload = {
  password: string;
  text: string;
  type?: IMsgType;
  description?: string;
  threadId: number;
};
