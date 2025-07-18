import React, { useState, useRef, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import TextAlign from "@tiptap/extension-text-align";
import FontSize from "@tiptap/extension-font-size";
import FontFamily from "@tiptap/extension-font-family";
import BulletList from "@tiptap/extension-bullet-list";
import ListItem from "@tiptap/extension-list-item";
import { FaBold, FaItalic, FaUnderline, FaStrikethrough, FaListUl, FaUndo, FaRedo, FaHeading, FaAlignLeft, FaAlignCenter, FaAlignRight, FaAlignJustify } from "react-icons/fa";
import { toast } from 'react-toastify';

const BASE_DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&punctuate=true&smart_format=true&utterances=true";

const FONT_FAMILIES = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

const FONT_SIZES = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
];

const VoiceReporting = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const runningTranscriptRef = useRef("");
  const lastPartialRef = useRef("");
  const searchRef = useRef(null);

  // TipTap editor instance
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Strike,
      BulletList,
      ListItem,
      FontSize.configure({ types: ["textStyle", "paragraph", "heading"] }),
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editable: true,
  });

  // Helper: Get Deepgram API key from env
  const getDeepgramApiKey = () => {
    return import.meta.env.VITE_DEEPGRAM_API_KEY;
  };

  // Map voice commands to text (e.g., 'next line' -> '\n', 'full stop' -> '.')
  const mapCommandsToText = (rawTranscript) => {
    // Replace 'full stop next line' or 'full stop. next line' with '.\n'
    let mapped = rawTranscript
      .replace(/\bfull stop[.\s]*next line\b/gi, '.\n')
      .replace(/\bnext line\b/gi, '\n')
      .replace(/\bfull stop\b/gi, '.');
    // After splitting, trim leading periods/spaces from each new line
    return mapped
      .split(/\n/)
      .map((line) => line.replace(/^\s*\.+\s*/, '').replace(/^\s+/, ''))
      .join('\n');
  };

  // Append transcript to TipTap editor
  const appendToEditor = (text) => {
    if (!editor) return;
    const mapped = mapCommandsToText(text);
    editor.commands.focus("end");
    // Get last character in editor
    const currentText = editor.getText();
    const lastChar = currentText.length > 0 ? currentText.slice(-1) : '';
    // Split by newlines and insert as paragraphs
    mapped.split(/\n/).forEach((line, idx) => {
      let toInsert = line;
      // If not first line and not empty, always new paragraph
      if (idx > 0) editor.commands.enter();
      // If not first line or if first line and editor not empty, check for space
      if (toInsert && lastChar && /[\w)]$/.test(lastChar) && /^[\w(]/.test(toInsert)) {
        toInsert = ' ' + toInsert;
      }
      if (toInsert) editor.commands.insertContent(toInsert);
    });
  };

  // Pause/Resume logic
  const handlePause = () => {
    setIsPaused(true);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }
  };

  // New Report logic
  const handleNewReport = () => {
    setFinalTranscript("");
    setLiveTranscript("");
    runningTranscriptRef.current = "";
    lastPartialRef.current = "";
    if (editor) editor.commands.setContent("");
  };

  // Start recording and streaming to Deepgram
  const handleStartRecording = async () => {
    setError("");
    setFinalTranscript("");
    setLiveTranscript("");
    setIsRecording(true);
    runningTranscriptRef.current = "";
    lastPartialRef.current = "";
    if (editor) editor.commands.setContent("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const apiKey = getDeepgramApiKey();
      if (!apiKey) {
        setError("Deepgram API key not found. Please set VITE_DEEPGRAM_API_KEY in your .env file.");
        setIsRecording(false);
        return;
      }
      const socket = new window.WebSocket(BASE_DEEPGRAM_URL, ["token", apiKey]);
      socketRef.current = socket;
      socket.onopen = () => {
        const mediaRecorder = new window.MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && socket.readyState === 1) {
            socket.send(event.data);
          }
        });
        mediaRecorder.start(250);
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (
            data.channel &&
            data.channel.alternatives &&
            data.channel.alternatives[0]
          ) {
            const alt = data.channel.alternatives[0];
            if (alt.transcript) {
              if (data.is_final) {
                const newText = alt.transcript.startsWith(lastPartialRef.current)
                  ? alt.transcript.slice(lastPartialRef.current.length)
                  : alt.transcript;
                runningTranscriptRef.current += (runningTranscriptRef.current ? " " : "") + newText;
                appendToEditor((runningTranscriptRef.current ? " " : "") + newText);
                setLiveTranscript("");
                setFinalTranscript(runningTranscriptRef.current.trim());
                lastPartialRef.current = "";
              } else {
                setLiveTranscript(
                  (runningTranscriptRef.current ? runningTranscriptRef.current + " " : "") + alt.transcript
                );
                lastPartialRef.current = alt.transcript;
              }
            }
          }
        } catch (err) {}
      };
      socket.onerror = (event) => {
        setError("WebSocket connection error. Please check your API key and network.");
        handleStopRecording();
      };
      socket.onclose = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        setIsRecording(false);
      };
    } catch (err) {
      setError("Could not access microphone: " + err.message);
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current && socketRef.current.readyState === 1) {
      socketRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // Fetch patients for search
  useEffect(() => {
    const fetchPatients = async () => {
      setLoadingPatients(true);
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const response = await fetch(`${API_URL}/patients/`);
        if (response.ok) {
          const data = await response.json();
          setPatients(data);
        } else {
          setError("Failed to fetch patients");
        }
      } catch (err) {
        setError("Error fetching patients: " + err.message);
      } finally {
        setLoadingPatients(false);
      }
    };
    fetchPatients();
  }, []);

  // Filter patients based on search query
  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.village.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.scan_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone.includes(searchQuery)
  );

  // Handle patient selection
  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSelectedPatientId(patient.id.toString());
    setSearchQuery(patient.name);
    setShowSearchResults(false);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setShowSearchResults(true);
    if (!e.target.value) {
      setShowSearchResults(false);
      setSelectedPatient(null);
      setSelectedPatientId("");
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Save report to backend
  const handleSaveReport = async () => {
    if (!selectedPatientId) {
      toast.error("Please select a patient first");
      return;
    }
    setIsSaving(true);
    setError("");
    
    try {
      // Stage 1: Creating Google Doc
      toast.info("Creating Google Doc from transcript...");
      
      // Get HTML content from TipTap
      const htmlContent = editor ? editor.getHTML() : "";
      // Example: POST to backend (adjust endpoint as needed)
      const API_URL = import.meta.env.VITE_API_URL;
      const response = await fetch(`${API_URL}/reports/voice-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          transcript: htmlContent,
          patient_id: parseInt(selectedPatientId)
        }),
      });
      
      if (!response.ok) throw new Error("Failed to save report");
      
      const data = await response.json();
      
      // Stage 2: Report created successfully
      toast.success("✅ Report created successfully!");
      
      // Stage 3: PDF uploaded to Supabase
      if (data.pdf_url) {
        toast.success("📄 PDF uploaded to cloud storage");
      }
      
      // Stage 4: WhatsApp message sent
      if (data.whatsapp_result && data.whatsapp_result.success) {
        toast.success("📱 WhatsApp message sent to patient");
      } else if (data.whatsapp_result) {
        toast.warning("⚠️ WhatsApp message may not have been sent");
      }
      
      // Final success message
      setTimeout(() => {
        toast.success("🎉 Report process completed! Check Google Docs and WhatsApp for details.");
      }, 10);
      
      // Show detailed info in console for debugging
      console.log("Report saved successfully:", data);
      
    } catch (err) {
      toast.error("❌ Failed to save report: " + err.message);
      setError("Failed to save report: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (socketRef.current && socketRef.current.readyState === 1) {
        socketRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Toolbar handlers
  const setFontFamily = (value) => {
    if (editor) editor.chain().focus().setFontFamily(value).run();
  };
  const setFontSize = (value) => {
    if (editor) editor.chain().focus().setFontSize(value).run();
  };
  const setAlignment = (value) => {
    if (editor) editor.chain().focus().setTextAlign(value).run();
  };

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col items-center justify-start overflow-y-auto">
      <div className="w-full max-w-none mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Voice Reporting</h1>
        <p className="text-gray-600 mb-6">Speak into the mic and see your report transcribed in real time. You can edit and format the text below.</p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
        {/* Patient Search and Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search and Select Patient *
          </label>
          <div className="relative" ref={searchRef}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search by name, village, scan type, or phone..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={loadingPatients}
            />
            {showSearchResults && searchQuery && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{patient.name}</div>
                      <div className="text-sm text-gray-600">
                        {patient.age} years, {patient.gender} • {patient.scan_type} • {patient.village}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-gray-500">No patients found</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Patient Details */}
        {selectedPatient && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-100 p-1.5 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">Selected Patient Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Personal Information */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Personal Information</h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Name:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Age:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.age} years</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Gender:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.gender}</span>
                    </div>
                  </div>
                </div>
                
                {/* Medical Information */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Medical Information</h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Scan Type:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.scan_type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Village:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.village}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Phone:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.phone}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-medium">Referred By:</span>
                      <span className="text-sm font-semibold text-gray-900">{selectedPatient.referred_by}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedPatient.notes && (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-semibold text-yellow-800">Notes</span>
                  </div>
                  <p className="text-xs text-yellow-700">{selectedPatient.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="mb-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-1 mb-2 items-center">
            <button onClick={() => editor && editor.chain().focus().toggleBold().run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('bold') ? 'bg-gray-200 font-bold' : 'bg-white'}`} type="button" title="Bold"><FaBold /></button>
            <button onClick={() => editor && editor.chain().focus().toggleItalic().run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('italic') ? 'bg-gray-200 italic' : 'bg-white'}`} type="button" title="Italic"><FaItalic /></button>
            <button onClick={() => editor && editor.chain().focus().toggleUnderline().run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('underline') ? 'bg-gray-200 underline' : 'bg-white'}`} type="button" title="Underline"><FaUnderline /></button>
            <button onClick={() => editor && editor.chain().focus().toggleStrike().run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('strike') ? 'bg-gray-200 line-through' : 'bg-white'}`} type="button" title="Strikethrough"><FaStrikethrough /></button>
            <button onClick={() => editor && editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 font-bold' : 'bg-white'}`} type="button" title="Heading 1"><FaHeading /></button>
            <button onClick={() => editor && editor.chain().focus().toggleBulletList().run()} className={`p-1 text-xs rounded border ${editor && editor.isActive('bulletList') ? 'bg-gray-200' : 'bg-white'}`} type="button" title="Bullet List"><FaListUl /></button>
            <button onClick={() => editor && editor.chain().focus().undo().run()} className="p-1 text-xs rounded border bg-white" type="button" title="Undo"><FaUndo /></button>
            <button onClick={() => editor && editor.chain().focus().redo().run()} className="p-1 text-xs rounded border bg-white" type="button" title="Redo"><FaRedo /></button>
            {/* Font Family Dropdown */}
            <select className="p-1 text-xs border rounded" onChange={e => setFontFamily(e.target.value)} value={editor && editor.getAttributes('fontFamily').fontFamily || 'inherit'} title="Font Family">
              {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            {/* Font Size Dropdown */}
            <select className="p-1 text-xs border rounded" onChange={e => setFontSize(e.target.value)} value={editor && editor.getAttributes('fontSize').fontSize || '16px'} title="Font Size">
              {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            {/* Alignment Icon Buttons */}
            <button onClick={() => setAlignment('left')} className={`p-1 text-xs rounded border ${editor && editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : 'bg-white'}`} type="button" title="Align Left"><FaAlignLeft /></button>
            <button onClick={() => setAlignment('center')} className={`p-1 text-xs rounded border ${editor && editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : 'bg-white'}`} type="button" title="Align Center"><FaAlignCenter /></button>
            <button onClick={() => setAlignment('right')} className={`p-1 text-xs rounded border ${editor && editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : 'bg-white'}`} type="button" title="Align Right"><FaAlignRight /></button>
            <button onClick={() => setAlignment('justify')} className={`p-1 text-xs rounded border ${editor && editor.isActive({ textAlign: 'justify' }) ? 'bg-gray-200' : 'bg-white'}`} type="button" title="Justify"><FaAlignJustify /></button>
          </div>
          <div
            className="border-2 border-green-500 rounded-lg bg-white w-full h-96 overflow-y-auto shadow-sm outline-none"
            style={{ padding: '0.5rem 1rem', width: '100%' }}
            tabIndex={-1}
          >
            <EditorContent editor={editor} className="outline-none" />
          </div>
          {isRecording && liveTranscript && (
            <div className="mt-2 text-gray-500 text-sm italic">{liveTranscript}</div>
          )}
        </div>
        <div className="flex gap-4 mb-4">
          {!isRecording && (
            <button
              onClick={handleStartRecording}
              className="bg-green-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Start Recording
            </button>
          )}
          {isRecording && !isPaused && (
            <button
              onClick={handlePause}
              className="bg-yellow-500 text-white py-2 px-6 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
            >
              Pause
            </button>
          )}
          {isRecording && isPaused && (
            <button
              onClick={handleResume}
              className="bg-green-500 text-white py-2 px-6 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Resume
            </button>
          )}
          {isRecording && (
            <button
              onClick={handleStopRecording}
              className="bg-red-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Stop Recording
            </button>
          )}
          <button
            onClick={handleNewReport}
            className="bg-gray-200 text-gray-800 py-2 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            New Report
          </button>
          {!isRecording && (editor && editor.getText().trim()) && (
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Report"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceReporting;