"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ProfileHeaderProps {
  user: {
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    isAdult: boolean;
  };
  themeAccent: string;
  activePlatforms: string[];
}

export function ProfileHeader({ user, themeAccent, activePlatforms }: ProfileHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full">
      {/* Cover */}
      <div
        className="h-32 w-full"
        style={{
          background: `linear-gradient(135deg, ${themeAccent}40, ${themeAccent}80)`,
        }}
      />

      {/* Avatar */}
      <div className="flex flex-col items-center -mt-11 px-6">
        <div
          className="w-22 h-22 rounded-full border-2 bg-bee-surface2 flex items-center justify-center overflow-hidden"
          style={{ borderColor: themeAccent }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <span
              className="font-bebas text-3xl"
              style={{ color: themeAccent }}
            >
              {getInitials(user.displayName)}
            </span>
          )}
        </div>

        {/* Display Name */}
        <h1 className="font-bebas text-2xl uppercase mt-4 tracking-wide text-center">
          {user.displayName}
        </h1>

        {/* Bio */}
        <p className="text-sm text-bee-muted text-center max-w-xs mx-auto mt-2 line-clamp-2 leading-relaxed">
          {user.bio}
        </p>

        {/* Platform Icons */}
        {activePlatforms.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            {activePlatforms.slice(0, 5).map((platform, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-bee-surface border border-bee-border flex items-center justify-center text-lg"
              >
                {platform}
              </div>
            ))}
            {activePlatforms.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-bee-surface border border-bee-border flex items-center justify-center text-xs text-bee-muted">
                +{activePlatforms.length - 5}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
