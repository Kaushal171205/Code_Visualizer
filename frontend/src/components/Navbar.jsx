import "../styling/Navbar.css";

const Navbar = ({
  theme,
  setTheme,
  onLanguageChange,
  currentPage,
  onPageChange,
}) => {
  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);

    if (newTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    localStorage.setItem("theme", newTheme);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <div className="navbar-logo">CodeLab</div>

        {/* Page Toggle */}
        <div className="page-toggle">
          <button
            className={`page-btn ${currentPage === "editor" ? "active" : ""}`}
            onClick={() => onPageChange("editor")}
          >
            <span className="btn-icon">📝</span>
            Editor
          </button>
          <button
            className={`page-btn ${currentPage === "visualizer" ? "active" : ""}`}
            onClick={() => onPageChange("visualizer")}
          >
            <span className="btn-icon">📊</span>
            Visualizer
          </button>
        </div>

        <div className="navbar-actions">
          {/* Language selector only shown in editor mode */}
          {currentPage === "editor" && (
            <select
              className="language-select"
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <option value="cpp">C++</option>
              <option value="c">C</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
            </select>
          )}

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
