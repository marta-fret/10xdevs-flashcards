import React, { useState } from "react";

import { Button } from "../ui/button";
import { LoadingOverlay } from "../ui/LoadingOverlay";
import { showToast } from "../ui/GlobalToastZone";

export const LogoutButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        showToast({ type: "error", message: "Failed to log out. Please try again." });
        setIsLoading(false);
        return;
      }

      window.location.assign("/login");
    } catch {
      showToast({ type: "error", message: "Failed to log out. Please try again." });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex">
      {isLoading && <LoadingOverlay />}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={isLoading}
        data-testid="logout-button"
      >
        {isLoading ? "Logging out..." : "Logout"}
      </Button>
    </div>
  );
};
