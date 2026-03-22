import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { StylistChat } from "@/components/chat/StylistChat";

const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const sharedGarment = searchParams.get("shared_garment");
  const sharedBrand = searchParams.get("brand");
  const sharedCategory = searchParams.get("category");

  // Build initial message from shared garment context
  const initialMessage = sharedGarment
    ? `How should I style this ${sharedGarment}${sharedBrand ? ` by ${sharedBrand}` : ""}${sharedCategory ? ` (${sharedCategory})` : ""}?`
    : undefined;

  return (
    <div className="pt-6">
      <StylistChat initialMessage={initialMessage} />
    </div>
  );
};

export default ChatPage;
