import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

export const Route = createFileRoute("/pads")({
  component: RouteComponent,
});

function RouteComponent() {
  const searchParams = Route.useSearch();
  const { sendJsonMessage } = useWebSocket(searchParams.wsaddress, {
    share: true,
    queryParams: { username: searchParams.username, role: "sender" },
  });

  const handleClick = useCallback(
    (i: number) => {
      sendJsonMessage(
        {
          type: "button",
          value: `/${searchParams.username}/button/${i}`,
        },
        false,
      );
    },
    [searchParams, sendJsonMessage],
  );

  return (
    <div className="grid grid-cols-4 p-2 gap-2 grid-flow-row content-stretch h-full w-full touch-none">
      {Array.from({ length: 16 }, (_, i) => (
        <button
          type="button"
          className="pointer btn btn-primary h-auto active:bg-accent transition-none select-none touch-manipulation"
          key={i}
          onPointerDown={() => handleClick(i)}
        >
          Pad {i}
        </button>
      ))}
    </div>
  );
}
