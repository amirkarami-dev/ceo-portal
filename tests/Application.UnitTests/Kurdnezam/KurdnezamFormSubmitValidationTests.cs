using Mabhas19.Application.Kurdnezam.Forms;
using Mabhas19.Domain.Kurdnezam;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Kurdnezam;

/// <summary>
/// Every rule the PUBLIC submit route enforces. This is the one path on the kurdnezam API that
/// anyone on the internet can write to, so each limit is asserted rather than assumed.
/// </summary>
[TestFixture]
public class KurdnezamFormSubmitValidationTests
{
    private const string Docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    /// <summary>A stand-in for one uploaded part; the real one wraps IFormFile.</summary>
    private sealed record Upload(int FieldId, string FileName, string ContentType, long SizeBytes)
        : IKurdnezamFormUpload
    {
        public Stream OpenRead() => new MemoryStream();
    }

    private static KurdnezamFormField Field(
        int id, string kind, bool required = false, bool multiple = false, int? maxLength = null) => new()
    {
        Id = id,
        Label = $"field {id}",
        Kind = kind,
        IsRequired = required,
        AllowMultiple = multiple,
        MaxLength = maxLength
    };

    private static KurdnezamForm FormWith(bool isOpen = true, params KurdnezamFormField[] fields)
    {
        var form = new KurdnezamForm { Id = 1, IsOpen = isOpen };
        foreach (var f in fields) form.Fields.Add(f);
        return form;
    }

    private static List<(string Key, string Message)> Check(
        KurdnezamForm form,
        IReadOnlyList<KurdnezamFormAnswerInput>? answers = null,
        IReadOnlyList<IKurdnezamFormUpload>? files = null)
        => SubmitKurdnezamFormCommandHandler.Validate(form, answers ?? [], files ?? []);

    // ── the happy path ───────────────────────────────────────────────────────

    [Test]
    public void A_filled_in_form_passes()
    {
        var form = FormWith(true,
            Field(1, KurdnezamFormFieldKinds.Text, required: true),
            Field(2, KurdnezamFormFieldKinds.File, required: true, multiple: true));

        var errors = Check(form,
            [new KurdnezamFormAnswerInput(1, "علی")],
            [new Upload(2, "card.pdf", "application/pdf", 1024)]);

        errors.ShouldBeEmpty();
    }

    [Test]
    public void An_optional_field_may_be_left_empty()
    {
        var form = FormWith(true,
            Field(1, KurdnezamFormFieldKinds.Text),
            Field(2, KurdnezamFormFieldKinds.File));

        Check(form).ShouldBeEmpty();
    }

    // ── a closed form ────────────────────────────────────────────────────────

    [Test]
    public void A_closed_form_refuses_everything_and_says_so_once()
    {
        var form = FormWith(false, Field(1, KurdnezamFormFieldKinds.Text, required: true));

        var errors = Check(form);

        errors.Count.ShouldBe(1, "a closed form should not also list every missing field");
        errors[0].Key.ShouldBe("Form");
    }

    // ── required ─────────────────────────────────────────────────────────────

    [TestCase("")]
    [TestCase("   ")]
    public void A_required_text_field_refuses_blank(string text)
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.Text, required: true));

        var errors = Check(form, [new KurdnezamFormAnswerInput(1, text)]);

        errors.ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void A_required_file_field_refuses_nothing_attached()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File, required: true));

        Check(form).ShouldContain(e => e.Key == "field_1");
    }

    // ── limits ───────────────────────────────────────────────────────────────

    [Test]
    public void Text_longer_than_the_field_allows_is_refused()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.Text, maxLength: 5));

        Check(form, [new KurdnezamFormAnswerInput(1, "123456")]).ShouldContain(e => e.Key == "field_1");
        Check(form, [new KurdnezamFormAnswerInput(1, "12345")]).ShouldBeEmpty();
    }

    [Test]
    public void A_single_file_field_refuses_a_second_file()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File, multiple: false));

        var errors = Check(form, null,
            [new Upload(1, "a.pdf", "application/pdf", 10), new Upload(1, "b.pdf", "application/pdf", 10)]);

        errors.ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void Even_a_multiple_field_stops_at_the_cap()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File, multiple: true));
        var tooMany = Enumerable
            .Range(0, KurdnezamFormUploadLimits.MaxFilesPerField + 1)
            .Select(n => (IKurdnezamFormUpload)new Upload(1, $"{n}.pdf", "application/pdf", 10))
            .ToList();

        Check(form, null, tooMany).ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void A_file_over_the_size_limit_is_refused()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File));

        var errors = Check(form, null,
            [new Upload(1, "big.pdf", "application/pdf", KurdnezamFormUploadLimits.MaxBytesPerFile + 1)]);

        errors.ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void An_empty_file_is_refused()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File));

        Check(form, null, [new Upload(1, "empty.pdf", "application/pdf", 0)])
            .ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void Several_files_that_are_each_small_enough_can_still_be_too_much_together()
    {
        // Note the arithmetic: one field allows 3 files of 5 MB, which is exactly the 15 MB
        // submission cap. So the total only bites across TWO file fields — that is the case worth
        // testing, and the one a real form with two attachments hits.
        var form = FormWith(true,
            Field(1, KurdnezamFormFieldKinds.File, multiple: true),
            Field(2, KurdnezamFormFieldKinds.File, multiple: true));

        var each = KurdnezamFormUploadLimits.MaxBytesPerFile;
        var files = new List<IKurdnezamFormUpload>
        {
            new Upload(1, "a.pdf", "application/pdf", each),
            new Upload(1, "b.pdf", "application/pdf", each),
            new Upload(2, "c.pdf", "application/pdf", each),
            new Upload(2, "d.pdf", "application/pdf", each),
        };

        files.Sum(f => f.SizeBytes).ShouldBeGreaterThan(KurdnezamFormUploadLimits.MaxBytesPerSubmission);
        Check(form, null, files).ShouldContain(e => e.Key == "Form");
    }

    [Test]
    public void One_field_filled_to_its_own_caps_is_still_allowed()
    {
        // The boundary the test above depends on: 3 x 5 MB is exactly the submission cap, so it
        // passes. If either limit changes, this is the test that says the two no longer line up.
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File, multiple: true));
        var files = Enumerable
            .Range(0, KurdnezamFormUploadLimits.MaxFilesPerField)
            .Select(n => (IKurdnezamFormUpload)new Upload(1, $"{n}.pdf", "application/pdf", KurdnezamFormUploadLimits.MaxBytesPerFile))
            .ToList();

        files.Sum(f => f.SizeBytes).ShouldBe(KurdnezamFormUploadLimits.MaxBytesPerSubmission);
        Check(form, null, files).ShouldBeEmpty();
    }

    // ── types ────────────────────────────────────────────────────────────────

    [TestCase("application/pdf")]
    [TestCase("image/jpeg")]
    [TestCase("image/png")]
    [TestCase(Docx)]
    public void The_allowed_types_are_accepted(string contentType)
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File));

        Check(form, null, [new Upload(1, "f", contentType, 10)]).ShouldBeEmpty();
    }

    [TestCase("application/x-msdownload")]
    [TestCase("text/html")]
    [TestCase("image/svg+xml")]
    [TestCase("")]
    public void Anything_else_is_refused(string contentType)
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.File));

        Check(form, null, [new Upload(1, "danger", contentType, 10)])
            .ShouldContain(e => e.Key == "field_1");
    }

    // ── shape ────────────────────────────────────────────────────────────────

    [Test]
    public void A_file_sent_to_a_text_field_is_refused()
    {
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.Text));

        Check(form, null, [new Upload(1, "a.pdf", "application/pdf", 10)])
            .ShouldContain(e => e.Key == "field_1");
    }

    [Test]
    public void Something_aimed_at_a_field_the_form_does_not_have_is_refused_not_dropped()
    {
        // A stale page must not quietly lose what somebody typed.
        var form = FormWith(true, Field(1, KurdnezamFormFieldKinds.Text));

        Check(form, [new KurdnezamFormAnswerInput(99, "hello")]).ShouldContain(e => e.Key == "field_99");
        Check(form, null, [new Upload(99, "a.pdf", "application/pdf", 10)]).ShouldContain(e => e.Key == "field_99");
    }
}
