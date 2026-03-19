import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { assetUrl } from '../utils/assetPath'
import BackButton from '../components/BackButton'
import { useShellParams } from '../hooks/useShellParams'

interface VideoInfo {
  title: string
  url: string
  lyrics?: string
  info?: string
}

export default function VideoPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { isFromShell, onGameComplete, shellBack } = useShellParams()

  // Get video info from URL params or fetch from data
  useEffect(() => {
    const url = searchParams.get('url')
    const title = searchParams.get('title') || 'Video'
    const lyrics = searchParams.get('lyrics') || undefined
    const info = searchParams.get('info') || undefined

    if (url) {
      setVideo({ title, url, lyrics, info })
      return
    }

    // Try to load from video data JSON, or fallback to file-based lookup
    fetch('/data/library_videos.json')
      .then(r => r.json())
      .then((videos: VideoInfo[]) => {
        const found = videos.find((v: any) => v.id === id)
        if (found) {
          setVideo(found)
        } else if (id) {
          // Curriculum videos: param is the filename (e.g. en_vdo_vowel)
          setVideo({ title: id.replace(/^en_vdo_/, '').replace(/_/g, ' '), url: assetUrl(`/assets/videos/${id}.mp4`) })
        }
      })
      .catch(() => {
        // Fallback if JSON fails
        if (id) {
          setVideo({ title: id.replace(/^en_vdo_/, '').replace(/_/g, ' '), url: assetUrl(`/assets/videos/${id}.mp4`) })
        }
      })
  }, [id, searchParams])

  // Handle video ended → mark game complete if from shell
  const handleVideoEnded = () => {
    if (isFromShell) {
      onGameComplete()
    }
  }

  if (!video) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 20,
      }}>
        <BackButton />
        Video not found
      </div>
    )
  }

  const isYouTube = video.url.includes('youtube.com') || video.url.includes('youtu.be')
  const youtubeEmbedUrl = isYouTube ? getYouTubeEmbedUrl(video.url) : null

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 48,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}>
        <BackButton onClick={isFromShell ? shellBack : undefined} />
        <span style={{
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '60%',
        }}>
          {video.title}
        </span>
      </div>

      {/* Video Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {isYouTube && youtubeEmbedUrl ? (
          <iframe
            src={youtubeEmbedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={video.url}
            controls
            autoPlay
            onEnded={handleVideoEnded}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {/* Info panel toggle */}
      {(video.lyrics || video.info) && (
        <>
          <button
            onClick={() => setShowInfo(!showInfo)}
            style={{
              position: 'absolute',
              bottom: showInfo ? 'auto' : 12,
              right: 12,
              zIndex: 20,
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 14,
            }}
          >
            {showInfo ? 'Hide Info' : 'Show Info'}
          </button>

          {showInfo && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '40%',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              padding: '16px 20px',
              overflowY: 'auto',
              zIndex: 15,
            }}>
              {video.lyrics && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ color: '#FFB347', marginBottom: 8 }}>Lyrics</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {video.lyrics}
                  </p>
                </div>
              )}
              {video.info && (
                <div>
                  <h4 style={{ color: '#FFB347', marginBottom: 8 }}>Info</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {video.info}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function getYouTubeEmbedUrl(url: string): string | null {
  let videoId = ''

  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || ''
  } else if (url.includes('youtube.com/watch')) {
    const params = new URL(url).searchParams
    videoId = params.get('v') || ''
  } else if (url.includes('youtube.com/embed/')) {
    videoId = url.split('embed/')[1]?.split('?')[0] || ''
  }

  if (!videoId) return null
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
}
