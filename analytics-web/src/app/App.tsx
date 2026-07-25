import { RouterProvider } from "react-router-dom";
import { Providers } from "./providers";
import { router } from "./router";

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

// Default export so existing `import App from "@/app/App"` in main.tsx and App.test.tsx
// continues to work after the task replaces the old placeholder.
export default App;
