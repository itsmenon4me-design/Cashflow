package expo.modules.reportdownload

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReportDownloadModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReportDownloads")

    AsyncFunction("saveToDownloads") { base64: String, filename: String, mimeType: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw IllegalStateException("Direct Downloads storage requires Android 10 or later.")
      }

      val context = appContext.reactContext
        ?: throw IllegalStateException("Android application context is unavailable.")
      val resolver = context.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, filename)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Android could not create the report in Downloads.")

      try {
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        resolver.openOutputStream(uri)?.use { output ->
          output.write(bytes)
        } ?: throw IllegalStateException("Android could not write the report file.")

        val completedValues = ContentValues().apply {
          put(MediaStore.Downloads.IS_PENDING, 0)
        }
        if (resolver.update(uri, completedValues, null, null) != 1) {
          throw IllegalStateException("Android could not finish saving the report.")
        }
      } catch (error: Exception) {
        resolver.delete(uri, null, null)
        throw error
      }
    }
  }
}
