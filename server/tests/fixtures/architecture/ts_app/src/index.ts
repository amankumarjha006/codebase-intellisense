import React from "react";
import { Button } from "@/components/button";
import { legacyHelper } from "./legacy.js";

export function App() {
  return Button() + legacyHelper();
}

