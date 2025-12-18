"""
Backend API for fetching LangSmith traces and serving presentations as PDF for annotation.
"""

from dotenv import load_dotenv
load_dotenv()

import os
import ast
import base64
import tempfile
import subprocess
from io import BytesIO
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from langsmith import Client


app = FastAPI(title="Slide Viewer API")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize LangSmith client
ls_client = Client()

# Cache for converted PDFs (trace_id -> pdf_bytes)
pdf_cache: dict[str, bytes] = {}

# Cache for chat-generated PPTX files
pptx_chat_cache: dict[str, bytes] = {}


# ============================================================================
# PPTX TO PDF CONVERSION
# ============================================================================

def convert_pptx_to_pdf(pptx_bytes: bytes) -> Optional[bytes]:
    """
    Convert PPTX to PDF using LibreOffice.
    Falls back to returning None if conversion fails.
    """
    try:
        # Create temporary files
        with tempfile.TemporaryDirectory() as tmpdir:
            pptx_path = Path(tmpdir) / "presentation.pptx"
            pdf_path = Path(tmpdir) / "presentation.pdf"
            
            # Write PPTX to temp file
            pptx_path.write_bytes(pptx_bytes)
            
            # Try to convert using LibreOffice
            # Common paths for LibreOffice
            libreoffice_cmds = [
                "soffice",  # Linux
                "libreoffice",  # Linux alternative
                "/Applications/LibreOffice.app/Contents/MacOS/soffice",  # macOS
            ]
            
            for cmd in libreoffice_cmds:
                try:
                    result = subprocess.run(
                        [
                            cmd,
                            "--headless",
                            "--convert-to",
                            "pdf",
                            "--outdir",
                            tmpdir,
                            str(pptx_path),
                        ],
                        capture_output=True,
                        timeout=30,
                        check=True,
                    )
                    
                    if pdf_path.exists():
                        print(f"Successfully converted PPTX to PDF using {cmd}")
                        return pdf_path.read_bytes()
                except subprocess.TimeoutExpired:
                    print(f"Timeout converting with {cmd} - file may be too large or corrupt")
                    continue
                except subprocess.CalledProcessError as e:
                    print(f"LibreOffice conversion failed with {cmd} - file may be corrupt or unsupported format")
                    if e.stderr:
                        print(f"  Error details: {e.stderr.decode()}")
                    continue
                except FileNotFoundError:
                    continue
            
            print("LibreOffice conversion failed - file may be corrupt or unsupported format")
            return None
            
    except Exception as e:
        print(f"Error converting PPTX to PDF: {e}")
        import traceback
        traceback.print_exc()
        return None


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TraceRun(BaseModel):
    run_id: str
    name: str
    run_type: str  # "llm", "tool", "chain", etc.
    status: str  # "success", "error", etc.
    start_time: str
    end_time: Optional[str] = None
    duration_ms: Optional[int] = None
    inputs_summary: Optional[str] = None  # Truncated/formatted inputs
    outputs_summary: Optional[str] = None  # Truncated/formatted outputs
    error: Optional[str] = None
    parent_run_id: Optional[str] = None


class TraceSlide(BaseModel):
    trace_id: str
    trace_name: str
    created_at: str
    pptx_base64: Optional[str] = None
    has_pdf: bool = False
    conversion_failed: bool = False
    error: Optional[str] = None
    runs: list[TraceRun] = []
    langsmith_url: Optional[str] = None


class TracesResponse(BaseModel):
    traces: list[TraceSlide]
    project_name: str


class FeedbackSubmission(BaseModel):
    trace_id: str
    feedback_type: str  # "trace" or "slide"
    content: str
    score: int  # 1-5 rating
    slide_number: Optional[int] = None
    timestamp: Optional[str] = None
    
    # Validate score is 1-5
    @field_validator('score')
    @classmethod
    def validate_score(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError('Score must be between 1 and 5')
        return v


class FeedbackResponse(BaseModel):
    success: bool
    message: str


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    trace_id: str
    message: str
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    response: str
    trace_id: str


# Simple in-memory storage (could be DB later)
feedback_storage: list[FeedbackSubmission] = []


# ============================================================================
# API ENDPOINTS
# ============================================================================

def format_io_summary(data: dict, max_length: int = 50000) -> str:
    """Format inputs/outputs as JSON string (with large limit for message history)"""
    import json
    try:
        text = json.dumps(data, indent=0)
        return text[:max_length] + "..." if len(text) > max_length else text
    except Exception:
        return str(data)[:max_length]


def extract_pptx_from_trace(trace_id: str) -> Optional[bytes]:
    """Extract PPTX bytes from a trace's finalize_presentation tool call."""
    project_name = os.getenv("LANGSMITH_PROJECT", "default")
    try:
        runs = list(ls_client.list_runs(
            project_name=project_name,
            trace_id=trace_id,
        ))

        for run in runs:
            if run.name == "finalize_presentation" and run.outputs:
                output = run.outputs.get("output")
                if not output:
                    continue

                content = output.get("content")
                if not content:
                    continue

                # content is often like "b'...'"
                if isinstance(content, bytes):
                    return content

                if isinstance(content, str):
                    try:
                        pptx_bytes = ast.literal_eval(content)
                        if isinstance(pptx_bytes, (bytes, bytearray)):
                            print(f"Extracted {len(pptx_bytes)} bytes from trace")
                            return bytes(pptx_bytes)
                    except Exception:
                        # Sometimes it might already be base64 or not literal-evaluable
                        pass

        print(f"No finalize_presentation output found in trace {trace_id}")
        return None

    except Exception as e:
        print(f"Error extracting PPTX from trace {trace_id}: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.get("/api/traces", response_model=TracesResponse)
async def get_recent_traces():
    """Get the last 3 traces with their PPTX outputs and all runs."""
    project_name = os.getenv("LANGSMITH_PROJECT", "default")

    try:
        root_runs = list(ls_client.list_runs(
            project_name=project_name,
            is_root=True,
            limit=3,
        ))

        result_traces: list[TraceSlide] = []
        for run in root_runs:
            trace_id = str(run.trace_id)
            
            # Build LangSmith URL
            langsmith_org = os.getenv("LANGSMITH_ORG", "")
            langsmith_project_id = os.getenv("LANGSMITH_PROJECT_ID", "")
            
            if langsmith_org and langsmith_project_id:
                langsmith_url = f"https://smith.langchain.com/o/{langsmith_org}/projects/p/{langsmith_project_id}?peek={trace_id}&peeked_trace={trace_id}"
            else:
                langsmith_url = None
            
            trace_slide = TraceSlide(
                trace_id=trace_id,
                trace_name=run.name or "Unnamed",
                created_at=run.start_time.isoformat() if run.start_time else "",
                langsmith_url=langsmith_url,
            )

            # Extract PPTX
            pptx_bytes = extract_pptx_from_trace(trace_id)
            if pptx_bytes:
                trace_slide.pptx_base64 = base64.b64encode(pptx_bytes).decode()
                
                # Try to convert to PDF and cache it
                pdf_bytes = convert_pptx_to_pdf(pptx_bytes)
                if pdf_bytes:
                    pdf_cache[trace_id] = pdf_bytes
                    trace_slide.has_pdf = True
                else:
                    trace_slide.has_pdf = False
                    trace_slide.conversion_failed = True
            else:
                trace_slide.error = "No PPTX output found in trace"

            # NEW: Fetch all child runs for the trace
            try:
                all_runs = list(ls_client.list_runs(
                    project_name=project_name,
                    trace_id=trace_id,
                ))
                
                trace_runs = []
                for r in sorted(all_runs, key=lambda x: x.start_time if x.start_time else ""):
                    duration = None
                    if r.end_time and r.start_time:
                        duration = int((r.end_time - r.start_time).total_seconds() * 1000)
                    
                    trace_runs.append(TraceRun(
                        run_id=str(r.id),
                        name=r.name or "Unnamed",
                        run_type=r.run_type or "unknown",
                        status=r.status or "unknown",
                        start_time=r.start_time.isoformat() if r.start_time else "",
                        end_time=r.end_time.isoformat() if r.end_time else None,
                        duration_ms=duration,
                        inputs_summary=format_io_summary(r.inputs) if r.inputs else None,
                        outputs_summary=format_io_summary(r.outputs) if r.outputs else None,
                        error=r.error if r.error else None,
                        parent_run_id=str(r.parent_run_id) if r.parent_run_id else None,
                    ))
                
                trace_slide.runs = trace_runs
            except Exception as e:
                print(f"Error fetching runs for trace {trace_id}: {e}")
                trace_slide.runs = []

            result_traces.append(trace_slide)

        return TracesResponse(traces=result_traces, project_name=project_name)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/traces/{trace_id}/slides.pdf")
async def get_trace_pdf(trace_id: str):
    """Get PDF version of a trace's presentation."""
    # Check cache first
    if trace_id in pdf_cache:
        return Response(
            content=pdf_cache[trace_id],
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=slides-{trace_id}.pdf"}
        )
    
    # Not in cache, try to extract and convert
    pptx_bytes = extract_pptx_from_trace(trace_id)
    if not pptx_bytes:
        raise HTTPException(status_code=404, detail="PPTX not found for this trace")
    
    pdf_bytes = convert_pptx_to_pdf(pptx_bytes)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Failed to convert PPTX to PDF")
    
    # Cache for future requests
    pdf_cache[trace_id] = pdf_bytes
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=slides-{trace_id}.pdf"}
    )


@app.post("/api/feedback", response_model=FeedbackResponse)
async def submit_feedback(submission: FeedbackSubmission):
    """Store feedback and attach to LangSmith trace."""
    try:
        submission.timestamp = datetime.utcnow().isoformat()
        feedback_storage.append(submission)
        
        # Attach feedback to LangSmith trace
        try:
            # Determine feedback key based on type
            if submission.feedback_type == "trace":
                key = "pptx_layout_quality"
                comment = f"PPTX Layout Score: {submission.score}/5\n\n{submission.content}"
            else:  # slide feedback
                key = f"slide_{submission.slide_number}_communication"
                comment = f"Slide {submission.slide_number} - Data Communication Score: {submission.score}/5\n\n{submission.content}"
            
            # Create feedback in LangSmith
            ls_client.create_feedback(
                run_id=submission.trace_id,
                key=key,
                score=submission.score / 5.0,  # Normalize to 0-1
                value=submission.score,
                comment=comment,
                feedback_source_type="api"  # Valid options: "api", "model"
            )
            
            print(f"✅ Attached feedback to LangSmith trace {submission.trace_id}")
            
        except Exception as e:
            print(f"⚠️ Failed to attach to LangSmith: {e}")
            # Continue even if LangSmith attachment fails
        
        return FeedbackResponse(
            success=True,
            message="Feedback submitted and attached to trace"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/feedback/{trace_id}")
async def get_feedback(trace_id: str):
    """Get all feedback for a specific trace."""
    trace_feedback = [f for f in feedback_storage if f.trace_id == trace_id]
    return {"feedback": trace_feedback}


@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """
    Chat with the agent using trace context.
    """
    try:
        # Import the agent from financial_slide_agent
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from financial_slide_agent import slide_agent, builder
        from langchain_core.messages import HumanMessage, ToolMessage
        
        # Get trace data
        project_name = os.getenv("LANGSMITH_PROJECT", "default")
        runs = list(ls_client.list_runs(
            project_name=project_name,
            trace_id=request.trace_id,
        ))
        
        # Extract the original data from the first run's inputs
        # The data is embedded in the HumanMessage content
        original_data_str = None
        original_prompt = None
        
        for run in runs:
            if run.inputs and 'messages' in run.inputs:
                messages = run.inputs['messages']
                if messages and len(messages) > 0:
                    first_msg = messages[0]
                    if isinstance(first_msg, dict):
                        content = first_msg.get('content', '')
                    else:
                        content = str(first_msg)
                    
                    # The content has format: "{prompt}\n\nData:\n{data}"
                    if '\n\nData:\n' in content:
                        parts = content.split('\n\nData:\n', 1)
                        original_prompt = parts[0]
                        original_data_str = parts[1]
                        break
        
        if not original_data_str:
            return ChatResponse(
                response="I couldn't find the original data from this trace. Please make sure you're opening a trace that contains slide generation data.",
                trace_id=request.trace_id
            )
        
        # Build the new prompt combining user's request with original data
        new_prompt = f"""{request.message}

Use the same data as before.

Data:
{original_data_str}"""
        
        # Reset builder
        builder.reset()
        
        # Invoke agent with new prompt
        from langsmith import uuid7
        result = slide_agent.invoke(
            {"messages": [HumanMessage(content=new_prompt)]},
            config={"configurable": {"thread_id": str(uuid7())}}
        )
        
        # Extract the PPTX bytes from finalize_presentation tool response
        pptx_bytes = None
        for message in result["messages"]:
            if isinstance(message, ToolMessage) and message.name == "finalize_presentation":
                content = message.content
                if isinstance(content, bytes):
                    pptx_bytes = content
                elif isinstance(content, str) and content.startswith("b'"):
                    import ast
                    try:
                        pptx_bytes = ast.literal_eval(content)
                    except Exception:
                        pass
                break
        
        if pptx_bytes:
            # Generate a unique ID for this generation
            import uuid
            generation_id = str(uuid.uuid4())[:8]
            
            # Save PPTX to cache
            cache_key = f"{request.trace_id}_{generation_id}"
            pptx_chat_cache[cache_key] = pptx_bytes
            
            # Also convert to PDF and cache it
            pdf_bytes = convert_pptx_to_pdf(pptx_bytes)
            if pdf_bytes:
                pdf_cache[cache_key] = pdf_bytes
            
            # Create download links
            pptx_download_url = f"/api/chat/download/{cache_key}.pptx"
            pdf_download_url = f"/api/chat/download/{cache_key}.pdf"
            
            response_text = f"""✅ **Slides Generated Successfully!**

I've created a new presentation based on your request.

📥 **Download Links:**
- [Download PPTX]({pptx_download_url})
- [Download PDF]({pdf_download_url})

The agent made {len([m for m in result['messages'] if hasattr(m, 'name')])} tool calls to create your slides."""
        else:
            # Agent didn't generate slides - extract its response
            last_message = result["messages"][-1]
            response_text = last_message.content if hasattr(last_message, 'content') else "I completed the request, but didn't generate slides. Please try asking me to create a specific presentation."
        
        return ChatResponse(
            response=response_text,
            trace_id=request.trace_id
        )
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Chat error:\n{error_details}")
        return ChatResponse(
            response=f"I encountered an error: {str(e)}\n\nPlease try rephrasing your request. Make sure to ask me to create or modify slides based on the data.",
            trace_id=request.trace_id
        )


@app.get("/api/chat/download/{cache_key}")
async def download_chat_generated_file(cache_key: str):
    """
    Download a chat-generated presentation (PPTX or PDF).
    """
    # Determine file type from extension
    if cache_key.endswith('.pptx'):
        actual_key = cache_key[:-5]  # Remove .pptx
        if actual_key in pptx_chat_cache:
            return Response(
                content=pptx_chat_cache[actual_key],
                media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                headers={"Content-Disposition": f"attachment; filename=slides-{actual_key}.pptx"}
            )
    elif cache_key.endswith('.pdf'):
        actual_key = cache_key[:-4]  # Remove .pdf
        if actual_key in pdf_cache:
            return Response(
                content=pdf_cache[actual_key],
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=slides-{actual_key}.pdf"}
            )
    
    raise HTTPException(status_code=404, detail="File not found or expired")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "langsmith_project": os.getenv("LANGSMITH_PROJECT", "default")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
