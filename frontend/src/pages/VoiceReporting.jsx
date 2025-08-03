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
import { FaBold, FaItalic, FaUnderline, FaStrikethrough, FaListUl, FaListOl, FaUndo, FaRedo, FaHeading, FaAlignLeft, FaAlignCenter, FaAlignRight, FaAlignJustify, FaMicrophone, FaMicrophoneSlash, FaSave, FaFileAlt, FaCheck, FaTimes } from "react-icons/fa";
import { toast } from 'react-toastify';
import { api } from "../utils/api";
import LoadingButton from "../components/LoadingButton";

const BASE_DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=false&utterances=true&diarize=false&multichannel=false&numerals=false";

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
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  
  // Tab management
  const [activeTab, setActiveTab] = useState("voice");
  
  // Template management
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("radiology_template.html");
  const [templateContent, setTemplateContent] = useState("");
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [saveType, setSaveType] = useState("draft"); // "draft" or "final"
  
  // Draft editing state
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingReportData, setEditingReportData] = useState(null);
  const [loadingDraftData, setLoadingDraftData] = useState(false);

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
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      setWordCount(words);
      setCharCount(chars);
    },
  });

  // Helper: Get Deepgram API key from env
  const getDeepgramApiKey = () => {
    return import.meta.env.VITE_DEEPGRAM_API_KEY;
  };

  // Load draft report data for editing
  const loadDraftReportData = async (reportId) => {
    try {
      setLoadingDraftData(true);
      const response = await api.get(`/reports/${reportId}/draft`);
      setEditingReportData(response);
      setEditingReportId(reportId);
      setIsEditingDraft(true);
      
      // Set the patient data
      if (response.patient) {
        setSelectedPatientId(response.patient.id.toString());
        setSelectedPatient(response.patient);
      }
      
      // Set the content in the editor
      if (editor && response.content) {
        editor.commands.setContent(response.content);
      }
      
      toast.success("✅ Draft report loaded successfully. You can now edit it.");
    } catch (error) {
      console.error("Error loading draft report:", error);
      toast.error("Failed to load draft report");
      // Clear any stored data
      localStorage.removeItem('editingDraftReport');
    } finally {
      setLoadingDraftData(false);
    }
  };

  // Check if we're editing a draft report on component mount
  useEffect(() => {
    const editingData = localStorage.getItem('editingDraftReport');
    if (editingData) {
      try {
        const data = JSON.parse(editingData);
        if (data.isEditing && data.reportId) {
          loadDraftReportData(data.reportId);
          // Clear the localStorage after loading
          localStorage.removeItem('editingDraftReport');
        }
      } catch (error) {
        console.error("Error parsing editing data:", error);
        localStorage.removeItem('editingDraftReport');
      }
    }
  }, []);

  // Map voice commands to text (e.g., 'next line' -> '\n', 'full stop' -> '.')
  const mapCommandsToText = (rawTranscript) => {
    // Replace voice commands with punctuation and formatting
    let mapped = rawTranscript
      // Line breaks and periods
      .replace(/\bfull stop[.\s]*next line\b/gi, '.\n')
      .replace(/\bnext line\b/gi, '\n')
      .replace(/\bfull stop\b/gi, '.')
      .replace(/\bperiod\b/gi, '.')
      
      // Question marks
      .replace(/\bquestion mark\b/gi, '?')
      .replace(/\bquestion\b/gi, '?')
      
      // Exclamation marks
      .replace(/\bexclamation mark\b/gi, '!')
      .replace(/\bexclamation\b/gi, '!')
      
      // Commas
      .replace(/\bcomma\b/gi, ',')
      
      // Colons and semicolons
      .replace(/\bcolon\b/gi, ':')
      .replace(/\bsemicolon\b/gi, ';')
      
      // Hyphens and dashes
      .replace(/\bhyphen\b/gi, '-')
      .replace(/\bdash\b/gi, '-')
      .replace(/\bminus\b/gi, '-')
      
      // Parentheses
      .replace(/\bopen parenthesis\b/gi, '(')
      .replace(/\bclose parenthesis\b/gi, ')')
      .replace(/\bleft parenthesis\b/gi, '(')
      .replace(/\bright parenthesis\b/gi, ')')
      
      // Brackets
      .replace(/\bopen bracket\b/gi, '[')
      .replace(/\bclose bracket\b/gi, ']')
      .replace(/\bleft bracket\b/gi, '[')
      .replace(/\bright bracket\b/gi, ']')
      
      // Quotes
      .replace(/\bopen quote\b/gi, '"')
      .replace(/\bclose quote\b/gi, '"')
      .replace(/\bleft quote\b/gi, '"')
      .replace(/\bright quote\b/gi, '"')
      .replace(/\bquote\b/gi, '"')
      
      // Apostrophes
      .replace(/\bapostrophe\b/gi, "'")
      .replace(/\bsingle quote\b/gi, "'")
      
      // Slashes
      .replace(/\bforward slash\b/gi, '/')
      .replace(/\bbackward slash\b/gi, '\\')
      .replace(/\boblique hyphen\b/gi, '/')
      .replace(/\boblique\b/gi, '/')
      
      // Other common symbols
      .replace(/\bat symbol\b/gi, '@')
      .replace(/\bhash\b/gi, '#')
      .replace(/\bpercent\b/gi, '%')
      .replace(/\bampersand\b/gi, '&')
      .replace(/\basterisk\b/gi, '*')
      .replace(/\bplus\b/gi, '+')
      .replace(/\bequals\b/gi, '=')
      .replace(/\bless than\b/gi, '<')
      .replace(/\bgreater than\b/gi, '>')
      .replace(/\btilde\b/gi, '~')
      .replace(/\bunderscore\b/gi, '_')
      .replace(/\bpipe\b/gi, '|');
    
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
    
    // Clear editing state
    setIsEditingDraft(false);
    setEditingReportId(null);
    setEditingReportData(null);
    setSelectedPatient(null);
    setSelectedPatientId("");
    setSearchQuery("");
    
    toast.info("Started new report. You can now create a fresh report.");
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
        const data = await api.get("/patients/");
        setPatients(data);
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
  const handleSaveReport = async (type = "draft") => {
    if (!selectedPatientId) {
      toast.error("Please select a patient first");
      return;
    }
    setIsSaving(true);
    setError("");
    
    try {
      // Get HTML content from TipTap
      const htmlContent = editor ? editor.getHTML() : "";
      
      if (isEditingDraft && editingReportId) {
        // Update existing draft report
        if (type === "draft") {
          toast.info("Updating draft report...");
          
          const data = await api.put(`/reports/${editingReportId}/draft`, {
            content: htmlContent
          });
          
          toast.success("✅ Draft report updated successfully!");
          console.log("Draft report updated:", data);
        } else if (type === "final") {
          // Finalize the existing draft report
          toast.info("Finalizing draft report...");
          
          const finalData = await api.post(`/reports/${editingReportId}/finalize`, {
            content: htmlContent
          });
          
          toast.success("✅ Report finalized successfully!");
          
          // Clear editing state
          setIsEditingDraft(false);
          setEditingReportId(null);
          setEditingReportData(null);
          
          console.log("Report finalized:", finalData);
        }
      } else {
        // Create new report
        if (type === "draft") {
          // Save as draft
          toast.info("Saving report as draft...");
          
          const data = await api.post("/reports/voice-doc", {
            transcript: htmlContent,
            patient_id: parseInt(selectedPatientId)
          });
          
          toast.success("✅ Report saved as draft successfully!");
          
          // Show success message with next steps
          setTimeout(() => {
            toast.success("📝 You can edit this report later and finalize it from the Reports section.");
          }, 1000);
          
          console.log("Report saved as draft:", data);
        } else if (type === "final") {
          // Save as final report
          toast.info("Saving report as final...");
          
          // First save as draft to get report ID
          const draftData = await api.post("/reports/voice-doc", {
            transcript: htmlContent,
            patient_id: parseInt(selectedPatientId)
          });
          
          // Then finalize the report
          const finalData = await api.post(`/reports/${draftData.report_id}/finalize`, {
            content: htmlContent
          });
          
          toast.success("✅ Report saved as final successfully!");
          
          // Show success message with PDF info
          setTimeout(() => {
            toast.success("📄 PDF report generated and uploaded to cloud storage.");
          }, 1000);
          
          console.log("Report saved as final:", finalData);
        }
      }
      
      // Clear the editor for next report
      if (editor) {
        editor.commands.clearContent();
      }
      
      // Close save options modal
      setShowSaveOptions(false);
      
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

  // Template management functions
  const fetchTemplates = async () => {
    try {
      const response = await api.get("/reports/templates");
      setTemplates(response.templates || []);
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      // Fallback to single template if API fails
      setTemplates(['radiology_template.html']);
      toast.warning("Using fallback template - server connection issue");
    }
  };

  const handleTemplateClick = async (templateName) => {
    try {
      const response = await api.get(`/reports/templates/${templateName}`);
      const templateContent = response.content;
      
      // Create a new window with the template HTML
      const newWindow = window.open('', '_blank');
      newWindow.document.write(templateContent);
      newWindow.document.close();
    } catch (error) {
      console.error("Failed to load template:", error);
      
      // Fallback: Show a basic template preview
      const fallbackTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dhanvantri Radiology Center Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .report-container {
              background-color: #ffffff;
              max-width: 800px;
              margin: 20px auto;
              padding: 40px;
              border: 1px solid #ccc;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding-bottom: 15px;
            }
            .header .logo-section {
              display: flex;
              align-items: center;
            }
            .header .logo {
              width: 70px;
              height: auto;
              margin-right: 15px;
            }
            .header .title-section {
              display: flex;
              flex-direction: column;
            }
            .header h1 {
              color: #1a3a6b;
              font-size: 36px;
              margin: 0;
              font-weight: bold;
            }
            .header .subtitle {
               color: #1e5799;
               font-size: 20px;
               margin: 0;
            }
            .header .services {
              margin-top: 10px;
              color: #333;
              font-size: 14px;
            }
            .header .contact-info {
              text-align: right;
              font-size: 14px;
              line-height: 1.6;
              color: #1e5799;
              font-weight: bold;
            }
            .divider {
              border: 0;
              height: 3px;
              background-color: #1e5799;
              margin: 0;
            }
            .patient-info {
              display: flex;
              justify-content: space-between;
              padding: 20px 0;
              font-size: 14px;
              line-height: 1.8;
            }
            .patient-info strong {
              color: #333;
            }
            .transcript-section {
              padding: 20px 0;
              min-height: 400px;
              font-size: 14px;
              color: #555;
            }
            .footer {
              padding-top: 50px;
              font-size: 14px;
              line-height: 1.8;
            }
            .footer .signature-line {
               width: 200px;
               height: 1px;
               background-color: #000;
               margin-top: 25px;
               margin-bottom: 5px;
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <div class="logo-section">
                <img src="https://i.imgur.com/gCvoC5B.png" alt="Brain Logo" class="logo">
                <div class="title-section">
                  <h1 style="color: #1a3a6b;">Dhanvantri</h1>
                  <span class="subtitle">Radiology Center</span>
                   <p class="services">MRI | X-Ray | CT - SCan | USG</p>
                </div>
              </div>
              <div class="contact-info">
                +91 9420332003<br>
                prashantchaudhari@gmail.com<br>
                At post kada , tal ashti ,<br>
                disti beed , maharashatra,<br>
                India, 414202
              </div>
            </div>
            <hr class="divider">
            <div class="patient-info">
              <div>
                <strong>Patient Name:</strong> Sample Patient<br>
                <strong>Sex:</strong> Male<br>
                <strong>Exam:</strong> X-Ray
              </div>
              <div>
                <strong>Exam Date:</strong> Dec 15, 2024<br>
                <strong>Age:</strong> 35<br>
                <strong>PID:</strong> 12345
              </div>
            </div>
            <hr style="border-top: 1px solid #ccc; border-bottom: none;">
            <div class="transcript-section">
              <p>Sample report findings and conclusions would appear here...</p>
            </div>
            <div class="footer">
              <strong>Radiologist:</strong><br>
              Dr. Prashant Chaudhari<br>
              Reg. No: 123123412341<br>
              <strong>Signature</strong>
              <div class="signature-line"></div>
            </div>
            <hr class="divider" style="margin-top: 20px;">
          </div>
        </body>
        </html>
      `;
      
      const newWindow = window.open('', '_blank');
      newWindow.document.write(fallbackTemplate);
      newWindow.document.close();
      
      toast.warning("Showing fallback template preview - server connection issue");
    }
  };

  // Load templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div className="w-full h-full bg-gray-50 p-6 flex flex-col items-center justify-start overflow-y-auto">
      <div className="w-full max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Voice Reporting</h1>
        <p className="text-gray-600 mb-6">Speak into the mic and see your report transcribed in real time. You can edit and format the text below.</p>
        
        {/* Draft Editing Indicator */}
        {loadingDraftData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Loading Draft Report...
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Please wait while we load the draft report data.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isEditingDraft && editingReportData && !loadingDraftData && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Editing Draft Report
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>You are editing a draft report for <strong>{editingReportData.patient?.name}</strong>.</p>
                  <p>Make your changes and save as draft or finalize the report.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
        
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("voice")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "voice"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Voice Reporting
              </button>
              <button
                onClick={() => setActiveTab("templates")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "templates"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Template Management
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "voice" && (
          <div>
            {/* Voice Reporting Content */}
            {/* Patient Search and Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search and Select Patient *
              </label>
              <div className="relative" ref={searchRef}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search by name, village, scan type, or phone..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loadingPatients}
                />
                {showSearchResults && searchQuery && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <div
                          key={patient.id}
                          onClick={() => handlePatientSelect(patient)}
                          className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{patient.name}</div>
                          <div className="text-sm text-gray-600">
                            {patient.age} years, {patient.gender} • {patient.scan_type} • {patient.village}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500">No patients found</div>
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

            {/* Report Editor */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              {/* Editor Header */}
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaFileAlt className="text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Report Editor</h2>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Auto-save enabled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{wordCount} words</span>
                    <span>{charCount} characters</span>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="bg-white border-b border-gray-200 px-6 py-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Text Formatting */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleBold().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Bold"
                    >
                      <FaBold size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleItalic().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Italic"
                    >
                      <FaItalic size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleUnderline().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Underline"
                    >
                      <FaUnderline size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleStrike().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Strikethrough"
                    >
                      <FaStrikethrough size={14} />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300"></div>

                  {/* Text Structure */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleHeading({ level: 1 }).run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Heading 1"
                    >
                      <FaHeading size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleBulletList().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Bullet List"
                    >
                      <FaListUl size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().toggleOrderedList().run()} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Numbered List"
                    >
                      <FaListOl size={14} />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300"></div>

                  {/* History */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => editor && editor.chain().focus().undo().run()} 
                      className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors" 
                      title="Undo"
                    >
                      <FaUndo size={14} />
                    </button>
                    <button 
                      onClick={() => editor && editor.chain().focus().redo().run()} 
                      className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors" 
                      title="Redo"
                    >
                      <FaRedo size={14} />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300"></div>

                  {/* Font Controls */}
                  <div className="flex items-center gap-2">
                    <select 
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      onChange={e => setFontFamily(e.target.value)} 
                      value={editor && editor.getAttributes('fontFamily').fontFamily || 'inherit'} 
                      title="Font Family"
                    >
                      {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select 
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      onChange={e => setFontSize(e.target.value)} 
                      value={editor && editor.getAttributes('fontSize').fontSize || '16px'} 
                      title="Font Size"
                    >
                      {FONT_SIZES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>

                  <div className="w-px h-6 bg-gray-300"></div>

                  {/* Alignment */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setAlignment('left')} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Align Left"
                    >
                      <FaAlignLeft size={14} />
                    </button>
                    <button 
                      onClick={() => setAlignment('center')} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Align Center"
                    >
                      <FaAlignCenter size={14} />
                    </button>
                    <button 
                      onClick={() => setAlignment('right')} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Align Right"
                    >
                      <FaAlignRight size={14} />
                    </button>
                    <button 
                      onClick={() => setAlignment('justify')} 
                      className={`p-2 rounded-md transition-colors ${editor && editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`} 
                      title="Justify"
                    >
                      <FaAlignJustify size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              <div className="p-6">
                <div className="min-h-[400px] border border-gray-200 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                  <EditorContent 
                    editor={editor} 
                    className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none" 
                  />
                </div>
                
                {/* Live Transcript Display */}
                {isRecording && liveTranscript && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <FaMicrophone className="text-blue-600 animate-pulse" />
                      <span className="text-sm font-medium text-blue-800">Live Transcript</span>
                    </div>
                    <p className="text-sm text-blue-700 italic">{liveTranscript}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              {!isRecording && (
                <LoadingButton
                  onClick={handleStartRecording}
                  loading={false}
                  className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
                >
                  <FaMicrophone />
                  Start Recording
                </LoadingButton>
              )}
              {isRecording && !isPaused && (
                <LoadingButton
                  onClick={handlePause}
                  loading={false}
                  className="bg-yellow-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-yellow-600 transition-colors shadow-sm"
                >
                  <FaMicrophoneSlash />
                  Pause
                </LoadingButton>
              )}
              {isRecording && isPaused && (
                <LoadingButton
                  onClick={handleResume}
                  loading={false}
                  className="bg-green-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-600 transition-colors shadow-sm"
                >
                  <FaMicrophone />
                  Resume
                </LoadingButton>
              )}
              {isRecording && (
                <LoadingButton
                  onClick={handleStopRecording}
                  loading={false}
                  className="bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-sm"
                >
                  <FaMicrophoneSlash />
                  Stop Recording
                </LoadingButton>
              )}
              <LoadingButton
                onClick={handleNewReport}
                loading={false}
                className="bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors shadow-sm"
              >
                <FaFileAlt />
                New Report
              </LoadingButton>
              {!isRecording && (editor && editor.getText().trim()) && (
                <div className="flex gap-2">
                  <LoadingButton
                    onClick={() => handleSaveReport("draft")}
                    loading={isSaving}
                    disabled={isSaving}
                    className="bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                    title="Save as draft - You can edit this report later"
                  >
                    <FaSave />
                    Save as Draft
                  </LoadingButton>
                  <LoadingButton
                    onClick={() => handleSaveReport("final")}
                    loading={isSaving}
                    disabled={isSaving}
                    className="bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
                    title="Save as final - Generates PDF and marks report as complete"
                  >
                    <FaCheck />
                    Save as Final
                  </LoadingButton>
                </div>
              )}
              
              {/* Save Options Info */}
              {!isRecording && (editor && editor.getText().trim()) && (
                <div className="mt-2 text-xs text-gray-600">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span><strong>Draft:</strong> Save for later editing</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span><strong>Final:</strong> Generate PDF and complete report</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div>
            {/* Template Management Content */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Available Templates</h2>
              <p className="text-gray-600 mb-6">Choose from our professionally designed templates for your radiology reports.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Template Preview Cards */}
                {templates.length > 0 ? (
                  templates.map((template, index) => (
                    <div
                      key={template}
                      className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                      onClick={() => handleTemplateClick(template)}
                      title="Click to view template in new tab"
                    >
                                              {/* Template Preview */}
                        <div className="relative mb-4">
                          <div className="w-full h-48 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 overflow-hidden shadow-sm">
                            {/* Template Preview Content */}
                            <div className="p-4 h-full flex flex-col">
                              {/* Header */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                                  <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                  </svg>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-blue-700">Dhanvantri</div>
                                  <div className="text-xs text-gray-600">Radiology Center</div>
                                </div>
                              </div>
                              
                              {/* Separator */}
                              <div className="h-px bg-gradient-to-r from-blue-200 to-transparent mb-2"></div>
                              
                              {/* Template Preview Content */}
                              <div className="flex-1 bg-white rounded border border-gray-100 p-2">
                                {/* Mini Header */}
                                <div className="flex items-center gap-1 mb-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <div className="text-xs font-bold text-blue-600">Dhanvantri</div>
                                </div>
                                <div className="text-xs text-gray-500 mb-1">Radiology Center</div>
                                
                                {/* Mini Separator */}
                                <div className="h-px bg-blue-300 mb-2"></div>
                                
                                {/* Mini Patient Info */}
                                <div className="grid grid-cols-2 gap-1 mb-2">
                                  <div className="text-xs">
                                    <span className="font-semibold text-gray-600">Name:</span>
                                    <span className="text-gray-400 ml-1">John Doe</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="font-semibold text-gray-600">Age:</span>
                                    <span className="text-gray-400 ml-1">35</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="font-semibold text-gray-600">Exam:</span>
                                    <span className="text-gray-400 ml-1">X-Ray</span>
                                  </div>
                                  <div className="text-xs">
                                    <span className="font-semibold text-gray-600">Date:</span>
                                    <span className="text-gray-400 ml-1">Dec 15</span>
                                  </div>
                                </div>
                                
                                {/* Mini Report Area */}
                                <div className="bg-gray-50 rounded p-1 mb-1">
                                  <div className="text-xs font-semibold text-gray-600 mb-1">Findings</div>
                                  <div className="text-xs text-gray-400 leading-tight">
                                    Sample findings content...
                                  </div>
                                </div>
                                
                                {/* Mini Footer */}
                                <div className="text-xs text-gray-500 text-center">
                                  Dr. Prashant Chaudhari
                                </div>
                              </div>
                              
                              {/* Footer */}
                              <div className="mt-3 text-xs text-gray-500 text-center">
                                Dr. Prashant Chaudhari
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <div className="absolute top-3 right-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Active
                            </span>
                          </div>
                          
                          {/* Click Indicator */}
                          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-blue-500 text-white p-1.5 rounded-full shadow-lg">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      
                      {/* Template Info */}
                      <div className="text-center">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">
                          DHANVANTRI TEMPLATE
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">Template ID: RAD-001</p>
                        
                        {/* Click to View Text */}
                        <div className="text-xs text-blue-600 font-medium group-hover:text-blue-700 transition-colors flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          View template
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Available</h3>
                    <p className="text-gray-500">Professional templates will be available here.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Template Information */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Professional Templates</h3>
                  <p className="text-blue-700 text-sm">
                    Our templates are professionally designed to match medical report standards. 
                    Each template includes proper formatting, branding, and all necessary sections 
                    for comprehensive radiology reports. The system automatically selects the 
                    appropriate template based on the report type.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceReporting;