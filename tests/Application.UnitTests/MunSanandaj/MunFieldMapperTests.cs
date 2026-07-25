using System.Text.Json;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunFieldMapperTests
{
    private static readonly MunEngineerInfoDto SampleEngineer = new(
        Ozviat: "1499",
        ShomarehNezam: "22-10-01079",
        FName: "حمید",
        LName: "پارسا",
        TarikhSodur: "1404/04/04",
        TarikhTamdid: "1404/05/05",
        TarikhPayanEtebar: "1405/04/04",
        PesronTyp: "1",
        NationalId: "4420716746",
        Mob: "9133240295",
        PayehNezaratTemp: "3",
        Major: "1");

    [Test]
    public void ToEngMapEngineer_maps_national_id_to_code_meli_and_persontype_to_branch()
    {
        var result = MunFieldMapper.ToEngMapEngineer(SampleEngineer);

        result.CodeMeli.ShouldBe("4420716746");
        result.Branch.ShouldBe(1); // from PesronTyp
        result.Task.ShouldBe(1);   // hardcoded
    }

    [Test]
    public void BuildAddEngineerPayload_maps_every_field_per_spec()
    {
        var payload = MunFieldMapper.BuildAddEngineerPayload(SampleEngineer);
        var json = JsonSerializer.Serialize(payload);
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        root.ValueKind.ShouldBe(JsonValueKind.Array);
        root.GetArrayLength().ShouldBe(1);
        var engineer = root[0];

        engineer.GetProperty("first_name").GetString().ShouldBe("حمید");
        engineer.GetProperty("last_name").GetString().ShouldBe("پارسا");
        engineer.GetProperty("father_name").GetString().ShouldBe("none");
        engineer.GetProperty("code_persontype_id").GetInt32().ShouldBe(1);
        engineer.GetProperty("national_code").GetString().ShouldBe("4420716746");
        engineer.GetProperty("mobile").GetString().ShouldBe("9133240295");
        engineer.GetProperty("membership_number").GetString().ShouldBe("1499");
        engineer.GetProperty("membership_date").GetString().ShouldBe("1404/04/04");
        engineer.GetProperty("renewal_date").GetString().ShouldBe("1404/04/04"); // from TarikhSodur, NOT TarikhTamdid
        engineer.GetProperty("membership_expire_date").GetString().ShouldBe("1405/04/04");

        var license = engineer.GetProperty("license")[0];
        license.GetProperty("license_number").GetString().ShouldBe("1499");
        license.GetProperty("license_issue_date").GetString().ShouldBe("1404/04/04");
        license.GetProperty("license_renewal_date").GetString().ShouldBe("1404/04/04");
        license.GetProperty("license_expire_date").GetString().ShouldBe("1405/04/04");
        license.GetProperty("economic_code").GetString().ShouldBe("41123456789");
        license.GetProperty("signature_code").GetString().ShouldBe("SGN-4589");
        license.GetProperty("description").GetString().ShouldBe("none");

        var branch = license.GetProperty("branch")[0];
        branch.GetProperty("code_engineeringbase_id").GetInt32().ShouldBe(3);   // from PayehNezaratTemp
        branch.GetProperty("code_engineeringbranch_id").GetInt32().ShouldBe(1); // hardcoded
        branch.GetProperty("code_engineeringtask_id").GetInt32().ShouldBe(1);   // from PesronTyp
        branch.GetProperty("issue_date").GetString().ShouldBe("1404/04/04");
        branch.GetProperty("expire_date").GetString().ShouldBe("1405/04/04");
    }
}
