import { Outlet } from "react-router-dom";
import BottomTabBar from "./BottomTabBar";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background pt-safe">
      <main className="pb-24 px-4">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
};

export default AppLayout;
