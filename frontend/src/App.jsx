import React, { useState, useEffect } from "react";
import { UploadCloud, FileText, Sparkles, Printer, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function App() {
  const [notesFile, setNotesFile] = useState(null);
  const [pastPaperFile, setPastPaperFile] = useState(null);

  const [notesText, setNotesText] = useState("");
  const [pastPapersText, setPastPapersText] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState("");
  const [error, setError] = useState("");

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const saved = localStorage.getItem("paperwise_saved_questions");
    if (saved) setGeneratedQuestions(saved);
  }, []);

  const handleSaveQuestions = (text) => {
    setGeneratedQuestions(text);
    if (text) {
      localStorage.setItem("paperwise_saved_questions", text);
    } else {
      localStorage.removeItem("paperwise_saved_questions");
    }
  };

  const uploadAndExtract = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/extract-text`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Failed to extract text from PDF");
    }

    const data = await response.json();
    return data.extracted_text;
  };

  const handleGenerate = async () => {
    if (!notesFile && !notesText) {
      setError("Please select at least your Lecture Notes / Syllabus PDF.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      let currentNotes = notesText;
      let currentPastPapers = pastPapersText;

      if (notesFile && !currentNotes) {
        setLoadingStage("Reading notes & running OCR on scanned pages...");
        currentNotes = await uploadAndExtract(notesFile);
        setNotesText(currentNotes);
      }

      if (pastPaperFile && !currentPastPapers) {
        setLoadingStage("Extracting text from past exam papers...");
        currentPastPapers = await uploadAndExtract(pastPaperFile);
        setPastPapersText(currentPastPapers);
      }

      setLoadingStage("Gemini AI is predicting high-yield questions...");
      const genResponse = await fetch(`${API_BASE_URL}/api/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes_text: currentNotes,
          past_papers_text: currentPastPapers,
        }),
      });

      if (!genResponse.ok) {
        const errData = await genResponse.json();
        throw new Error(errData.detail || "Failed to generate exam questions.");
      }

      const resultData = await genResponse.json();
      handleSaveQuestions(resultData.questions);
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header - Hidden during print */}
        <header className="print:hidden flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <span className="p-2 bg-indigo-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </span>
              Paperwise AI
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Extract lecture notes, run OCR on handwriting, and generate exam questions.
            </p>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="print:hidden p-4 bg-red-950/80 border border-red-800 rounded-xl flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Dropzones - Hidden during print */}
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-indigo-400 uppercase tracking-wide">1. Study Notes / Syllabus (Required)</h3>
            <label className="mt-3 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition">
              <UploadCloud className="w-7 h-7 text-slate-400 mb-1" />
              <span className="text-xs text-slate-300">Upload PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  setNotesFile(e.target.files[0] || null);
                  setNotesText("");
                }}
              />
            </label>
            {notesFile && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 bg-slate-800 p-2.5 rounded-lg">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="truncate">{notesFile.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">2. Past Exam Papers (Optional)</h3>
            <label className="mt-3 border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition">
              <UploadCloud className="w-7 h-7 text-slate-400 mb-1" />
              <span className="text-xs text-slate-300">Upload PDF</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  setPastPaperFile(e.target.files[0] || null);
                  setPastPapersText("");
                }}
              />
            </label>
            {pastPaperFile && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-300 bg-slate-800 p-2.5 rounded-lg">
                <FileText className="w-4 h-4 text-purple-400" />
                <span className="truncate">{pastPaperFile.name}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="print:hidden flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 font-semibold text-white rounded-xl shadow-lg disabled:opacity-50 transition flex items-center gap-2 text-sm"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? "Generating..." : "Generate Expected Exam Questions"}
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="print:hidden p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-300 animate-pulse">{loadingStage}</p>
          </div>
        )}

        {/* Formatted Exam Paper Sheet */}
        {generatedQuestions && (
          <div className="bg-white text-slate-900 rounded-xl shadow-xl p-8 md:p-12 print:p-0 print:shadow-none print:bg-white print:text-black">
            
            {/* Top Toolbar (Hidden when printing/saving to PDF) */}
            <div className="print:hidden flex items-center justify-between pb-6 mb-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Generated Examination Paper</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow transition"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => handleSaveQuestions("")}
                  className="p-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-lg border border-slate-200 transition"
                  title="Clear"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rendered Typography using ReactMarkdown */}
            <div className="markdown-content text-slate-800 leading-relaxed space-y-4">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-black text-center border-b-2 border-slate-900 pb-2 mb-4 tracking-tight uppercase" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-lg font-bold border-b border-slate-300 pb-1 mt-6 mb-3 text-slate-900 uppercase" {...props} />,
                  h3: ({node, ...props}) => <h3 className="text-base font-bold text-indigo-900 mt-4 mb-1" {...props} />,
                  p: ({node, ...props}) => <p className="text-sm text-slate-700 leading-relaxed mb-2" {...props} />,
                  blockquote: ({node, ...props}) => (
                    <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/70 p-3 rounded-r text-xs text-indigo-950 font-medium italic my-2" {...props} />
                  ),
                  ul: ({node, ...props}) => <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-2" {...props} />,
                  ol: ({node, ...props}) => <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1 mb-2" {...props} />,
                  code: ({node, ...props}) => <code className="bg-slate-100 text-indigo-600 font-mono text-xs px-1.5 py-0.5 rounded border border-slate-200" {...props} />,
                  hr: () => <hr className="my-6 border-slate-300" />,
                }}
              >
                {generatedQuestions}
              </ReactMarkdown>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}