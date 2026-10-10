/**
 * RexaCloud Server Creation Wizard
 * Screen 4 in reference image:
 * Multi-step wizard with vertical step indicators:
 * 1. Server Details (Name, Description, Type, Software, Version, Start Egg)
 * 2. Server Settings (Variables, Docker Image)
 * 3. Resource Allocation (Node, RAM, CPU, Disk, Allocations)
 * 4. Confirm & Create (Validation, submission, API response)
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { ChevronRight, Check, ArrowRight, ArrowLeft, Loader2, Server, CheckCircle2 } from 'lucide-react';

export const CreateServerWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdServer, setCreatedServer] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Survival Server',
    description: 'A community survival multiplayer server running Paper 1.20.4',
    serverType: 'Minecraft',
    software: 'Paper',
    version: '1.20.4',
    eggId: 1,
    nestId: 1,
    nodeId: 1,
    memoryMB: 6144,
    cpuPercent: 300,
    diskMB: 51200,
    port: 25565,
    databasesLimit: 2,
    backupsLimit: 3,
  });

  const steps = [
    { num: 1, title: 'Server Details' },
    { num: 2, title: 'Server Settings' },
    { num: 3, title: 'Resource Allocation' },
    { num: 4, title: 'Confirm & Create' },
  ];

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.createServer({
        name: formData.name,
        description: formData.description,
        userId: 1,
        nestId: formData.nestId,
        eggId: formData.eggId,
        nodeId: formData.nodeId,
        limits: {
          memory: formData.memoryMB,
          swap: 0,
          disk: formData.diskMB,
          io: 500,
          cpu: formData.cpuPercent,
        },
        featureLimits: {
          databases: formData.databasesLimit,
          allocations: 1,
          backups: formData.backupsLimit,
        },
        allocation: {
          default: 1,
        },
      });

      setCreatedServer(res.server);
    } catch (err: any) {
      setError(err.message || 'Server creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/servers" className="hover:text-purple-300 transition-colors">
          Servers
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">Create New Server</span>
      </div>

      {/* 2. Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create New Server</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure hardware limits, software eggs, and initial container environment
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Success banner */}
      {createdServer ? (
        <div className="bg-[#100D1A] border border-purple-500/40 rounded-2xl p-8 text-center space-y-4 shadow-xl shadow-purple-950/40">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Server Provisioned Successfully!</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The server container was deployed on Node-01. Initializing startup script and downloading software egg.
          </p>

          <div className="bg-[#160F25] p-4 rounded-xl max-w-md mx-auto text-left text-xs font-mono text-slate-300 space-y-1.5 border border-purple-900/30">
            <div><span className="text-slate-500">Name:</span> {createdServer.name}</div>
            <div><span className="text-slate-500">Identifier:</span> {createdServer.identifier || 'srv-new'}</div>
            <div><span className="text-slate-500">Node:</span> Node-01 (Frankfurt)</div>
            <div><span className="text-slate-500">RAM:</span> {formData.memoryMB} MB</div>
            <div><span className="text-slate-500">CPU:</span> {formData.cpuPercent}%</div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setCreatedServer(null);
                setCurrentStep(1);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201833] text-slate-200 border border-purple-900/40"
            >
              Create Another
            </button>
          </div>
        </div>
      ) : (
        /* 3. Main Wizard Layout: Steps on left, Form on right (Recreates Screen 4) */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Left Vertical Step Indicator */}
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-4">
            {steps.map((step) => {
              const isCurrent = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-3.5 p-2 rounded-xl transition-all ${
                    isCurrent ? 'bg-purple-950/40 text-white' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast
                        ? 'bg-purple-600 text-white'
                        : isCurrent
                        ? 'bg-purple-600 text-white ring-4 ring-purple-600/20'
                        : 'border border-slate-700 text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
              );
            })}
          </div>

          {/* Right Form Card */}
          <div className="md:col-span-3 bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            {/* Step 1: Server Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Server Details
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Server Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Survival Server"
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Server Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="A short description about your server"
                    rows={2}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Server Type</label>
                    <select
                      value={formData.serverType}
                      onChange={(e) => setFormData({ ...formData, serverType: e.target.value })}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Minecraft">Minecraft</option>
                      <option value="Rust">Rust</option>
                      <option value="Source Engine">Source Engine</option>
                      <option value="Voice & Bot">Voice &amp; Bot</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Software</label>
                    <select
                      value={formData.software}
                      onChange={(e) => setFormData({ ...formData, software: e.target.value })}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="Paper">Paper</option>
                      <option value="Purpur">Purpur</option>
                      <option value="Velocity">Velocity</option>
                      <option value="Fabric">Fabric</option>
                      <option value="Forge">Forge</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Version</label>
                    <select
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="1.20.4">1.20.4</option>
                      <option value="1.20.2">1.20.2</option>
                      <option value="1.19.4">1.19.4</option>
                      <option value="1.18.2">1.18.2</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Start Egg</label>
                    <select
                      value={formData.eggId}
                      onChange={(e) => setFormData({ ...formData, eggId: Number(e.target.value) })}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value={1}>Minecraft (Paper)</option>
                      <option value={2}>Minecraft (Purpur)</option>
                      <option value={3}>Minecraft (Velocity)</option>
                      <option value={4}>Minecraft (Fabric)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Server Settings */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Server Settings
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Docker Image</label>
                  <input
                    type="text"
                    readOnly
                    value="ghcr.io/pterodactyl/yolks:java_21"
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs font-mono text-purple-300 select-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Server Jarfile</label>
                  <input
                    type="text"
                    defaultValue="server.jar"
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Java Startup Arguments</label>
                  <input
                    type="text"
                    defaultValue="-Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false"
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Resource Allocation */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Resource Allocation
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Deployment Node</label>
                  <select
                    value={formData.nodeId}
                    onChange={(e) => setFormData({ ...formData, nodeId: Number(e.target.value) })}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={1}>Node-01 (Frankfurt) — 128 GB RAM / 10 Gbps</option>
                    <option value={2}>Node-02 (London) — 128 GB RAM / Ryzen 9 7950X</option>
                    <option value={3}>Node-03 (New York) — 64 GB RAM / US-East</option>
                    <option value={4}>Node-04 (Dallas) — 64 GB RAM / US-Central</option>
                  </select>
                </div>

                {/* Memory Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Memory Limit</span>
                    <span className="text-purple-400 font-bold">{formData.memoryMB} MB ({(formData.memoryMB / 1024).toFixed(1)} GB)</span>
                  </div>
                  <input
                    type="range"
                    min="1024"
                    max="16384"
                    step="1024"
                    value={formData.memoryMB}
                    onChange={(e) => setFormData({ ...formData, memoryMB: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* CPU Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">CPU Limit</span>
                    <span className="text-purple-400 font-bold">{formData.cpuPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="600"
                    step="50"
                    value={formData.cpuPercent}
                    onChange={(e) => setFormData({ ...formData, cpuPercent: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Disk Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Disk Space</span>
                    <span className="text-purple-400 font-bold">{formData.diskMB} MB ({(formData.diskMB / 1024).toFixed(0)} GB)</span>
                  </div>
                  <input
                    type="range"
                    min="10240"
                    max="102400"
                    step="5120"
                    value={formData.diskMB}
                    onChange={(e) => setFormData({ ...formData, diskMB: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Confirm & Create */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Confirm &amp; Create Server
                </h2>

                <div className="bg-[#140E24] border border-purple-900/30 rounded-xl p-4 divide-y divide-purple-900/20 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Server Name</span>
                    <span className="font-semibold text-white">{formData.name}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Software / Egg</span>
                    <span className="font-semibold text-purple-300">{formData.software} {formData.version}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Target Node</span>
                    <span className="font-semibold text-white">Node-01 (Frankfurt)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">RAM Limit</span>
                    <span className="font-semibold text-white">{formData.memoryMB} MB</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">CPU Limit</span>
                    <span className="font-semibold text-white">{formData.cpuPercent}%</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Disk Space</span>
                    <span className="font-semibold text-white">{formData.diskMB} MB</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  By clicking Create Server, the request will be dispatched to the Pterodactyl Application API for immediate container initialization.
                </p>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-purple-900/20">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Provisioning Container...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Submit &amp; Create Server</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
