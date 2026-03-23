import { useSearchParams } from "react-router-dom";
import { StylistChat } from "@/components/chat/StylistChat";

const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const sharedGarment = searchParams.get("shared_garment");
  const sharedBrand = searchParams.get("brand");
  const sharedCategory = searchParams.get("category");
  const outfitName = searchParams.get("outfit_name");
  const outfitGarments = searchParams.get("outfit_garments");

  let initialMessage: string | undefined;

  if (outfitName && outfitGarments) {
    const garmentList = outfitGarments.split("|").map(g => g.trim()).join(", ");
    initialMessage = `I love this outfit called "${outfitName}" which includes: ${garmentList}. Can you help me recreate this look from my wardrobe, or suggest what I need to buy?`;
  } else if (sharedGarment) {
    initialMessage = `How should I style this ${sharedGarment}${sharedBrand ? ` by ${sharedBrand}` : ""}${sharedCategory ? ` (${sharedCategory})` : ""}?`;
  }

  return (
    <div className="pt-6">
      <StylistChat initialMessage={initialMessage} />
    </div>
  );
};

export default ChatPage;
