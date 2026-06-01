import { useState, useRef, useEffect } from 'react';
// Assuming the functions in apiCall.js are exported. 
// If they are not exported in your local file, please add 'export' before 'async function' in apiCall.js
import apiCall from './services/apiCall';

function App() {
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [numThumbnails, setNumThumbnail] = useState(1);
  const [headshotUrl, setHeadshotUrl] = useState("");
  const [jobId, setJobId] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  const [thumbnails, setThumbnails] = useState([]);
  const [jobStatus, setJobStatus] = useState(""); // "", "running", "completed", "failed"
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await apiCall.uploadHeadshot(file);
      if (result && result.url) {
        setHeadshotUrl(result.url);
      } else {
        setError("Upload failed or no URL returned.");
      }
    } catch (err) {
      setError(err?.message || "Failed to upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateJob = async () => {
    if (!prompt || !headshotUrl) {
      setError("Please provide a prompt and upload a headshot first.");
      return;
    }
    setIsCreatingJob(true);
    setError(null);
    setThumbnails([]);
    setJobStatus("");
    setJobId(null);

    try {
      const result = await apiCall.createJob({
        prompt,
        numThumbnails: parseInt(numThumbnails),
        headshotUrl
      });

      if (result && result.jobId) {
        setJobId(result.jobId);
        setJobStatus("running");
        startSubscription(result.jobId);
      } else {
        setError("Job creation failed.");
      }
    } catch (err) {
      setError(err?.message || "Failed to create job.");
    } finally {
      setIsCreatingJob(false);
    }
  };

  const startSubscription = async (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    eventSourceRef.current = await apiCall.subscribeToJob(id, {
      onThumbnailReady: (data) => {
        setThumbnails(prev => {
          if (prev.find(t => t.thumbnailId === data.thumbnailId)) return prev;
          return [...prev, data];
        });
      },
      onThumbnailFailed: (data) => {
        setThumbnails(prev => {
          if (prev.find(t => t.thumbnailId === data.thumbnailId)) return prev;
          return [...prev, data];
        });
      },
      onJobComplete: (data) => {
        setJobStatus("completed");
      },
      OnError: (data) => {
        setError(data?.error || "Stream error occurred");
        setJobStatus("failed");
      }
    });
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-indigo-700">YouTube Thumbnail Maker</h1>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="space-y-8">
            {/* Step 1: Upload */}
            <div className="p-6 border border-gray-200 rounded-xl bg-gray-50 shadow-sm">
              <h2 className="text-xl font-bold mb-4 text-gray-800">1. Upload Headshot</h2>
              <div className="flex flex-col gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-600
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100 cursor-pointer"
                />
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Uploading..." : "Upload Headshot"}
                </button>
                {headshotUrl && (
                  <div className="mt-2 text-green-600 text-sm font-medium flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    Uploaded successfully!
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Job Form */}
            <div className="p-6 border border-gray-200 rounded-xl bg-gray-50 shadow-sm">
              <h2 className="text-xl font-bold mb-4 text-gray-800">2. Generate Settings</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500"
                    rows="3"
                    placeholder="E.g., A programmer looking surprised at a glowing laptop screen..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Number of Thumbnails</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={numThumbnails}
                    onChange={(e) => setNumThumbnail(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-3 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Select between 1 and 3 thumbnails.</p>
                </div>
                <button
                  onClick={handleCreateJob}
                  disabled={!headshotUrl || !prompt || isCreatingJob}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-md transition-colors shadow-sm disabled:bg-emerald-300 disabled:cursor-not-allowed"
                >
                  {isCreatingJob ? "Starting Job..." : "Generate Thumbnails"}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Results */}
          <div className="p-6 border border-gray-200 rounded-xl bg-gray-50 shadow-sm flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">3. Results</h2>
              <div className="text-sm px-3 py-1 rounded-full bg-white border font-medium flex items-center gap-2">
                {jobStatus === "running" && <><span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>Generating...</>}
                {jobStatus === "completed" && <><span className="w-2 h-2 rounded-full bg-green-500"></span>Completed</>}
                {jobStatus === "failed" && <><span className="w-2 h-2 rounded-full bg-red-500"></span>Failed</>}
                {!jobStatus && <span className="text-gray-500">Waiting to start</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2">
              {thumbnails.map((thumb) => (
                <div key={thumb.thumbnailId} className="border border-gray-200 rounded-lg bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-semibold text-gray-700 capitalize">Style: {thumb.styleName}</span>
                    {thumb.errorMessage ? (
                      <span className="text-red-600 text-sm font-bold bg-red-100 px-2 py-0.5 rounded">Failed</span>
                    ) : (
                      <span className="text-green-600 text-sm font-bold bg-green-100 px-2 py-0.5 rounded">Ready</span>
                    )}
                  </div>

                  <div className="p-4">
                    {thumb.errorMessage ? (
                      <div className="text-red-500 text-sm p-4 text-center bg-red-50 rounded-md">{thumb.errorMessage}</div>
                    ) : (
                      <div className="space-y-3">
                        <img src={thumb.imagekitUrl} alt={thumb.styleName} className="w-full h-auto rounded-md border border-gray-200 bg-gray-50" loading="lazy" />
                        {thumb.variants && Object.keys(thumb.variants).length > 0 && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                            <p className="font-medium mb-1">Available Variants:</p>
                            <ul className="list-disc pl-5">
                              {Object.entries(thumb.variants).map(([key, url]) => (
                                <li key={key}><a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{key}</a></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {thumbnails.length === 0 && jobStatus !== "running" && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-12">
                  <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  <p className="text-lg font-medium text-gray-500">No thumbnails generated yet</p>
                  <p className="text-sm text-gray-400 mt-1 text-center max-w-xs">Upload a headshot and enter a prompt to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
