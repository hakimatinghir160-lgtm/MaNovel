import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";

export default function AndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = async () => {
      // إذا لم نكن في الصفحة الرئيسية، ارجع للصفحة السابقة
      if (location.pathname !== "/") {
        navigate(-1);
        return;
      }

      // إذا كنا في الصفحة الرئيسية، أغلق التطبيق
      CapacitorApp.exitApp();
    };

    const listener = CapacitorApp.addListener(
      "backButton",
      handleBackButton
    );

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate]);

  return null;
}