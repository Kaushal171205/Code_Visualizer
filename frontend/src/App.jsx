import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import CodeEditor from "./Pages/CodeEditor";
import Visualizer from "./Pages/Visualizer";

function App() {
  const [theme, setTheme] = useState("light");
  const [language, setLanguage] = useState("cpp");
  const [code, setCode] = useState("");
  const [currentPage, setCurrentPage] = useState("editor"); // "editor" or "visualizer"

  // Load saved theme on app start
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);

    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  return (
    <>
      <Navbar
        theme={theme}
        setTheme={setTheme}
        onLanguageChange={setLanguage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
      {currentPage === "editor" ? (
        <CodeEditor
          theme={theme}
          language={language}
          code={code}
          setCode={setCode}
        />
      ) : (
        <Visualizer theme={theme} />
      )}
    </>
  );
}

export default App;
