import { createFileRoute } from "@tanstack/react-router";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import Camera from "@/components/Camera";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const searchParams = Route.useSearch();
  const { sendMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

  return (
    <div className="relative flex h-full w-full bg-black">
      {!window.max && <Camera sendMessage={sendMessage} />}
    </div>
  );
}
