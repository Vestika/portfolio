from scipy.io import wavfile
import numpy as np
from datetime import datetime, timedelta
import os
import subprocess
import shutil


def get_ffmpeg_path():
    """Get the full path to ffmpeg on Mac"""
    # First try the Homebrew path
    homebrew_path = "/opt/homebrew/bin/ffmpeg"
    if os.path.exists(homebrew_path):
        return homebrew_path

    # Try the Intel Mac Homebrew path
    intel_homebrew_path = "/usr/local/bin/ffmpeg"
    if os.path.exists(intel_homebrew_path):
        return intel_homebrew_path

    # Try to find ffmpeg in PATH
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        return ffmpeg_path

    raise FileNotFoundError("ffmpeg not found. Please install it using 'brew install ffmpeg'")


def time_str_to_seconds(time_str):
    """Convert time string (MM:SS) to seconds"""
    time_obj = datetime.strptime(time_str, "%H:%M:%S")
    delta = timedelta(hours=time_obj.hour, minutes=time_obj.minute, seconds=time_obj.second)
    return int(delta.total_seconds())


def split_wav_file(file_path, segments):
    """
    Split a WAV file into multiple MP3 segments using ffmpeg

    Args:
        file_path (str): Path to the input WAV file
        segments (list): List of tuples containing (start_time, duration, name)
                        start_time in format "MM:SS"
                        duration in seconds
                        name as string
    """
    try:
        # Get the full path to ffmpeg
        ffmpeg_path = get_ffmpeg_path()
        print(f"Using ffmpeg from: {ffmpeg_path}")

        for start_time, duration, name in segments:
            try:
                # Create output filename
                output_filename = f"{name.replace(' ', '_')}.mp3"

                # Use ffmpeg to cut and convert to MP3
                cmd = [
                    ffmpeg_path,  # Full path to ffmpeg
                    '-i', file_path,  # Input file
                    '-ss', start_time,  # Start time
                    '-t', str(duration),  # Duration
                    '-acodec', 'libmp3lame',  # MP3 codec
                    '-q:a', '2',  # Quality (2 is high quality, lower number = higher quality)
                    output_filename,  # Output file
                    '-y'  # Overwrite output file if it exists
                ]

                # Run ffmpeg command
                result = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )

                if result.returncode == 0:
                    print(f"Created: {output_filename}")
                else:
                    error_message = result.stderr.decode()
                    print(f"Error creating {output_filename}: {error_message}")

            except Exception as e:
                print(f"Error processing segment {name}: {str(e)}")
                continue

    except Exception as e:
        print(f"Error processing file: {str(e)}")


def main():
    # Example usage
    d = {
    "/Users/mpalarya/Downloads/recs/20250103083512.wav": [ # 03 Jan
        ],
    "/Users/mpalarya/Downloads/recs/20250105130824.wav": [ # 05 Jan
        ],
    "/Users/mpalarya/Downloads/recs/20250108121620.wav": [ # 08 Jan
        ("00:44:30", 105, "lo_beseder"),
        ("00:49:25", 17, "flotz"),
        ("00:51:25", 10, "mezalzel"),
        ("00:51:40", 11, "yarden"),
        ("00:53:11", 39, "bedek_bait"),
        ("01:01:32", 6, "kod"),
        ("01:01:44", 25, "hafsakat_hashmal")
        ],
    "/Users/mpalarya/Downloads/recs/20250112074440.wav": [ # 11 Jan
        ],
    "/Users/mpalarya/Downloads/recs/20250112124446.wav": [ # 12 Jan
        ],
        "/Users/mpalarya/Downloads/recs/20250108071614.wav": [ # 08 Jan
            ("04:35:10", 15, "sheket"),
        ],
        "/Users/mpalarya/Downloads/recs/20250110075614.wav":  [ # 11 Jan
            ("01:25:00", 3, "lo_lagaat"),
            ("02:29:22", 45, "lo_laalot"),
            ("01:43:57", 5, "takum_aharon"),
            ("02:23:00", 5, "dai_maspik"),
            ("02:28:33", 20, "lo_laalot2"),
        ],
        "/Users/mpalarya/Downloads/recs/20250105080817.wav": [  # 05 Jan
            ("02:32:05", 11, "takshiv"),
        ],
    }

    for f in d:
        if not d[f]:
            continue
        split_wav_file(f, d[f])

if __name__ == "__main__":
    main()