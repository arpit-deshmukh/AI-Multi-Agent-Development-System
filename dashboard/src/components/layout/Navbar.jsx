import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const { pathname } = useLocation();

  const navItems = [
  { name: "Overview", path: "/" },
  { name: "Architecture", path: "/architecture" },
  { name: "Process", path: "/process" },
  { name: "Prompt Guide", path: "/prompt" },   
  { name: "Agents", path: "/agents" },         
  { name: "Try App", path: "/app" },   
  { name: "Visualization", path: "/visualization" },       
];

  return (
    <nav className="flex gap-6 px-6 py-3 border-b border-gray-800 bg-black/30 backdrop-blur">
      {navItems.map((item) => (
        <Link
          key={item.name}
          to={item.path}
          className={`text-sm transition ${
            pathname === item.path
              ? "text-green-400"
              : "text-gray-400 hover:text-white"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
}