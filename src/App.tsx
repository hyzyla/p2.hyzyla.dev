import "./App.css";

import Module from "@jspawn/qpdf-wasm/qpdf.js";
import WASM_URL from "@jspawn/qpdf-wasm/qpdf.wasm?url";
import React, { useMemo, useRef } from "react";

import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();

async function loadQPDF(): Promise<QPDFModule> {
  const module = await Module({
    locateFile: () => WASM_URL,
  });

  return module;
}

function UploadButton({ onChange }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleClick = async () => {
    inputRef.current?.click();
  };

  return (
    <>
      <input type="file" ref={inputRef} onChange={onChange} style={{ display: "none" }} />
      <Button onClick={handleClick}>Upload PDF</Button>
    </>
  );
}

function App() {
  const editorRef = useRef<unknown>(null);
  const [pdfJson, setPdfJson] = React.useState<string>("");
  const [pdf, setPdf] = React.useState<Uint8Array | null>(null);

  // memoize pdf document file
  const pdfDocument = useMemo(() => {
    if (!pdf) return null;
    return { data: pdf };
  }, [pdf]);

  const handleFileChage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const mod = await loadQPDF();

    const file = e.target.files?.[0];
    if (!file) return;

    const working = "/working";
    mod.FS.mkdir(working);

    const input = `${working}/input.pdf`;
    mod.FS.writeFile(input, new Uint8Array(await file?.arrayBuffer()));

    const output = `${working}/output.json`;

    // qpdf --json-output in.pdf pdf.json
    const exitCode = mod.callMain([
      "--json-output",
      "--object-streams=disable",
      "--compress-streams=n",
      "--normalize-content=y",
      input,
      output,
    ]);
    if (exitCode !== 0) throw new Error("qpdf exited with code " + exitCode);

    const otputBuffer = mod.FS.readFile(output);
    const outputJsonString = new TextDecoder().decode(otputBuffer);
    setPdfJson(outputJsonString);
    const outputJson = JSON.parse(outputJsonString);
    console.log(outputJson);
  };

  const handleGenreatePDF = async () => {
    const mod = await loadQPDF();
    const working = "/working";
    mod.FS.mkdir(working);

    // save the json to a file
    mod.FS.writeFile(`${working}/output2.json`, pdfJson);

    // qpdf --json-input pdf.json out.pdf
    const exitCode = mod.callMain(["--json-input", `${working}/output2.json`, `${working}/out.pdf`]);
    if (exitCode !== 0) throw new Error("qpdf exited with code " + exitCode);

    // read the pdf file and set state
    const pdfBuffer = mod.FS.readFile(`${working}/out.pdf`);
    setPdf(pdfBuffer);
  };

  const handleEditorDidMount = (editor: unknown) => {
    editorRef.current = editor;
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="p-2 gap-y-2 flex flex-col">
      <div className="flex gap-x-2">
        <UploadButton onChange={handleFileChage} />
        <Button onClick={handleGenreatePDF}>Update PDF</Button>
      </div>
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border min-h-[200px]">
        <ResizablePanel>
          {pdfJson && (
            <Editor
              height="90vh"
              width="100%"
              defaultLanguage="json"
              defaultValue={pdfJson}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
              }}
            />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel>
          {pdf && (
            <div className="flex flex-col items-center">
              <div className="w-full">
                <iframe
                  src={URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }))}
                  className="w-full h-[90vh]"
                />
              </div>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default App;
