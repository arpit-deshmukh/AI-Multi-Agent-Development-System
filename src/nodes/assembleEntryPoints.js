import { readFile, writeFile, getFileList } from "../utils/sandboxManager.js";

export function assembleBackendEntry(sandboxId, fileRegistry, blueprint) {
  const routeFiles = fileRegistry.filter(f => 
    f.path?.includes("backend/src/routes/") && f.path?.endsWith(".js")
  );

  if (routeFiles.length === 0) {
    console.log("No route files found — skipping backend entry assembly");
    return;
  }

  let content = readFile(sandboxId, "backend/src/index.js") || "";

  if (!content.includes("ROUTE_IMPORTS_PLACEHOLDER") && !content.includes("ROUTE_MOUNTS_PLACEHOLDER")) {
    const missingRoutes = routeFiles.filter(r => !content.includes(r.path.split("/").pop().replace(".js", "")));
    if (missingRoutes.length === 0) {
      console.log("Backend index.js already has all routes");
      return;
    }
    console.log(`Backend index.js missing ${missingRoutes.length} routes — rebuilding`);
  }

  const imports = [];
  const mounts = [];

  for (const routeFile of routeFiles) {
    const fileName = routeFile.path.split("/").pop().replace(".js", "");
    const varName = fileName.replace(/Routes?$/, "").replace(/[^a-zA-Z]/g, "") + "Routes";
    
    let mountPath = `/api/${fileName.replace(/Routes?$/, "").replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")}`;
    
    if (blueprint?.entities) {
      const entity = blueprint.entities.find(e => {
        const fileBase = fileName.toLowerCase().replace(/routes?$/i, "");
        return e.modelFile?.toLowerCase().includes(fileBase) || 
               e.routeFile?.toLowerCase().includes(fileBase);
      });
      if (entity?.apiPath) mountPath = entity.apiPath;
    }

    if (fileName.toLowerCase().includes("auth")) mountPath = "/api/auth";

    imports.push(`import ${varName} from './routes/${fileName}.js';`);
    mounts.push(`app.use('${mountPath}', ${varName});`);
  }

  if (content.includes("ROUTE_IMPORTS_PLACEHOLDER")) {
    content = content.replace("// ROUTE_IMPORTS_PLACEHOLDER", imports.join("\n"));
    content = content.replace("// ROUTE_MOUNTS_PLACEHOLDER", mounts.join("\n"));
  } else {
    content = `import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { connectDB } from './config/db.js';
${imports.join("\n")}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

${mounts.join("\n")}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
  });
});

export default app;
`;
  }

  writeFile(sandboxId, "backend/src/index.js", content);
  console.log(`Backend index.js: ${imports.length} routes wired`);
}

export function assembleFrontendEntry(sandboxId, fileRegistry, blueprint) {
  const pageFiles = fileRegistry.filter(f =>
    f.path?.includes("frontend/src/pages/") && f.path?.endsWith(".jsx")
  );

  if (pageFiles.length === 0) {
    console.log("No page files found — skipping frontend entry assembly");
    return;
  }

  let content = readFile(sandboxId, "frontend/src/App.jsx") || "";

  if (!content.includes("PAGE_IMPORTS_PLACEHOLDER") && !content.includes("PAGE_ROUTES_PLACEHOLDER")) {
    const missingPages = pageFiles.filter(p => {
      const name = p.path.split("/").pop().replace(".jsx", "");
      return !content.includes(name);
    });
    if (missingPages.length === 0) {
      console.log("Frontend App.jsx already has all pages");
      return;
    }
    console.log(`Frontend App.jsx missing ${missingPages.length} pages — rebuilding`);
  }

  const imports = [];
  const routes = [];

  for (const pageFile of pageFiles) {
    const componentName = pageFile.path.split("/").pop().replace(".jsx", "");
    
    let route = `/${componentName.replace(/Page$/, "").toLowerCase()}`;
    if (blueprint?.frontendPages) {
      const bpPage = blueprint.frontendPages.find(p => 
        p.name === componentName || p.name === componentName.replace("Page", "")
      );
      if (bpPage?.route) route = bpPage.route;
    }

    if (componentName.toLowerCase().includes("login")) route = "/login";
    if (componentName.toLowerCase().includes("register")) route = "/register";
    if (componentName.toLowerCase().includes("dashboard")) route = "/dashboard";

    imports.push(`import ${componentName} from './pages/${componentName}';`);
    routes.push(`        <Route path="${route}" element={<${componentName} />} />`);
  }

  const hasAuthContext = fileRegistry.some(f => f.path?.includes("context/Auth"));
  const authImport = hasAuthContext 
    ? `import { AuthProvider } from './context/AuthContext';\n` 
    : "";
  const authWrapStart = hasAuthContext ? "    <AuthProvider>\n" : "";
  const authWrapEnd = hasAuthContext ? "    </AuthProvider>\n" : "";

  const hasLogin = routes.some(r => r.includes('"/login"'));
  const hasDashboard = routes.some(r => r.includes('"/dashboard"'));
  const defaultRoute = hasDashboard ? "/dashboard" : hasLogin ? "/login" : routes.length > 0 ? "/" : "/";

  content = `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
${authImport}${imports.join("\n")}

export default function App() {
  return (
    <BrowserRouter>
${authWrapStart}      <Routes>
${routes.join("\n")}
        <Route path="/" element={<Navigate to="${defaultRoute}" replace />} />
      </Routes>
${authWrapEnd}    </BrowserRouter>
  );
}
`;

  writeFile(sandboxId, "frontend/src/App.jsx", content);
  console.log(`Frontend App.jsx: ${imports.length} pages wired, default → ${defaultRoute}`);
}